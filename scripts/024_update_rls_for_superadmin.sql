-- =====================================================
-- Migration 024: Update RLS Functions for Superadmin
-- =====================================================
-- Purpose: Update RLS helper functions to use is_superadmin flag
-- instead of role = 'admin' for cross-org access.
--
-- IMPORTANT: This changes the behavior of is_system_admin() to
-- only return true for superadmins, not all admins.
-- =====================================================

-- Step 1: Create is_superadmin() helper function
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  -- If no auth context, deny
  IF safe_auth_email() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has is_superadmin = true
  RETURN EXISTS (
    SELECT 1
    FROM dashboard_users
    WHERE email = safe_auth_email()
      AND is_superadmin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update is_system_admin() to use superadmin check
-- This is the key change: regular admins no longer bypass RLS
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Now delegates to is_superadmin() instead of checking role = 'admin'
  RETURN is_superadmin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create is_org_admin function for org-specific admin checks
-- Useful for future org-level admin operations
CREATE OR REPLACE FUNCTION is_org_admin(target_org_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  IF safe_auth_email() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmin has admin access to all orgs
  IF is_superadmin() THEN
    RETURN TRUE;
  END IF;

  -- Check if user is owner or admin of the target org
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN dashboard_users u ON u.id = om.user_id
    WHERE u.email = safe_auth_email()
      AND om.organization_id = target_org_id
      AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION (run manually after migration)
-- =====================================================
-- Test as superadmin (should return true):
-- SELECT is_superadmin();
--
-- Test is_system_admin (should now only return true for superadmins):
-- SELECT is_system_admin();
--
-- Test is_org_admin for a specific org:
-- SELECT is_org_admin(1);  -- Replace 1 with actual org ID
