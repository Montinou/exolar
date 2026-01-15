-- =====================================================
-- Migration 023: Add Superadmin Role
-- =====================================================
-- Purpose: Add is_superadmin flag to distinguish superadmins
-- from regular admins. Superadmins have full cross-org access.
--
-- IMPORTANT: Only agusmontoya@gmail.com should be superadmin.
-- =====================================================

-- Step 1: Add is_superadmin column to dashboard_users
ALTER TABLE dashboard_users
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Set agusmontoya@gmail.com as superadmin
UPDATE dashboard_users
SET is_superadmin = TRUE
WHERE email = 'agusmontoya@gmail.com';

-- Step 3: Create index for superadmin lookups (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_dashboard_users_superadmin
ON dashboard_users(is_superadmin) WHERE is_superadmin = TRUE;

-- =====================================================
-- VERIFICATION (run manually after migration)
-- =====================================================
-- SELECT email, role, is_superadmin FROM dashboard_users WHERE is_superadmin = TRUE;
-- Expected: agusmontoya@gmail.com | admin | true
