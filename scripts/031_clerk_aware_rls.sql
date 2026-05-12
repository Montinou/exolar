-- =====================================================
-- Migration 031: Make RLS helpers Clerk-aware
-- =====================================================
-- Context:
--   The RLS helpers introduced in 010_add_rls_policies.sql call
--   `auth.email()`, a Neon-Auth-specific PostgreSQL function. Post-Clerk
--   migration (028), that function does not exist; `safe_auth_email()`
--   catches the exception and returns NULL, which makes `is_org_member`
--   and `is_system_admin` always return FALSE. RLS-enabled tables would
--   deny every user request — but the application connects as the table
--   owner (`neondb_owner`), which bypasses RLS by default, so the broken
--   helpers haven't been visible. RLS as currently deployed is cosmetic.
--
-- This migration:
--   1. Adds `safe_clerk_user_id()` — reads `current_setting('app.clerk_user_id', true)`,
--      returns NULL if unset. The application sets this via SET LOCAL inside
--      a transaction (see lib/db/connection.ts `withSessionContext` in this PR).
--   2. Rewrites `is_org_member(target_org_id)` to resolve the calling user via
--      clerk_user_id → dashboard_users → organization_members.
--   3. Rewrites `is_system_admin()` to resolve the calling user via
--      clerk_user_id → dashboard_users.is_superadmin.
--   4. Keeps `is_service_account()` as-is (the CI/CD path bypass).
--   5. Leaves `safe_auth_email()` in place but marks it deprecated — some
--      old policies may still reference it; they continue to work (return
--      FALSE consistently). A follow-up migration can drop it once no
--      policy references it.
--
-- This migration is non-destructive: existing policies keep working
-- (since they go through `is_org_member` which is being rewritten to
-- the new behavior). RLS is NOT being forced yet — `FORCE ROW LEVEL
-- SECURITY` is a follow-up migration (032) after lib/db has been
-- refactored to call `withSessionContext` on every query path.
--
-- ROLLBACK: re-create `is_org_member` and `is_system_admin` from
-- 010_add_rls_policies.sql (the auth.email()-based versions).
-- =====================================================

BEGIN;

-- 1. Clerk-aware session reader.
--    `current_setting('app.clerk_user_id', true)` returns NULL if not set,
--    or the value previously set via `SET LOCAL app.clerk_user_id = '...'`.
--    The `true` argument suppresses the error that would normally raise.
CREATE OR REPLACE FUNCTION safe_clerk_user_id()
RETURNS TEXT AS $$
DECLARE
  v_val TEXT;
BEGIN
  v_val := current_setting('app.clerk_user_id', true);
  IF v_val IS NULL OR v_val = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_val;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Org membership check via Clerk identity.
--    Resolves clerk_user_id → dashboard_users.id → organization_members.
--    Returns TRUE if the calling user is a member of the target org.
CREATE OR REPLACE FUNCTION is_org_member(target_org_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_clerk_id TEXT;
BEGIN
  v_clerk_id := safe_clerk_user_id();
  IF v_clerk_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN dashboard_users u ON u.id = om.user_id
    WHERE u.clerk_user_id = v_clerk_id
      AND om.organization_id = target_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Superadmin check via Clerk identity.
--    `is_system_admin` is the name used in existing policies — keep it.
--    Maps to `dashboard_users.is_superadmin = true` for the calling user.
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_clerk_id TEXT;
BEGIN
  v_clerk_id := safe_clerk_user_id();
  IF v_clerk_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM dashboard_users
    WHERE clerk_user_id = v_clerk_id
      AND is_superadmin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. is_service_account() stays as-is (was already not auth.email() dependent).
--    For reference, it reads `current_setting('app.is_service_account', true)`
--    and the lib/db `setServiceAccountContext` / `sql.transaction([SET LOCAL ...])`
--    helpers populate it.

-- 5. Deprecate safe_auth_email() — keep the symbol so old policies that
--    still reference it don't crash, but document the deprecation.
COMMENT ON FUNCTION safe_auth_email IS
  'Deprecated: relies on Neon Auth''s auth.email() function which is unavailable '
  'after the Clerk migration (028). Always returns NULL in the current deployment. '
  'Use safe_clerk_user_id() in new policies. Will be dropped after a sweep '
  'confirms no policies reference it.';

COMMIT;

-- =====================================================
-- Sanity (run after the migration):
--
--   -- The new helper exists
--   SELECT proname, proargnames FROM pg_proc
--   WHERE proname IN ('safe_clerk_user_id','is_org_member','is_system_admin');
--
--   -- Setting works (run inside a transaction)
--   BEGIN;
--     SET LOCAL app.clerk_user_id = 'user_3Bgd35pc0KZ2bZmmehloVSVAD2r';
--     SELECT safe_clerk_user_id();      -- expect: 'user_3Bgd35pc0KZ2bZmmehloVSVAD2r'
--     SELECT is_org_member(1);          -- expect: true for AttorneyShare user
--     SELECT is_system_admin();         -- expect: based on is_superadmin
--   COMMIT;
--
-- =====================================================
