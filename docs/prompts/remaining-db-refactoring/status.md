# Remaining Database Refactoring - Status

## Overview

Refactor remaining standalone database files (`lib/db-orgs.ts`, `lib/db-wishlist.ts`, `lib/db-users.ts`) into the modular `lib/db/` structure.

## Current Status: **Phase 3 Complete**

| Phase | Status | Prompt | Last Updated |
|-------|--------|--------|--------------|
| Investigation | **completed** | [investigation/prompt.xml](investigation/prompt.xml) | 2026-01-07T20:01:17Z |
| Phase 1: Migrate Orgs | **completed** | [phases/01_migrate_orgs.xml](phases/01_migrate_orgs.xml) | 2026-01-07T20:06:44Z |
| Phase 2: Migrate Wishlist | **completed** | [phases/02_migrate_wishlist.xml](phases/02_migrate_wishlist.xml) | 2026-01-07T20:11:43Z |
| Phase 3: Migrate Users | **completed** | [phases/03_migrate_users.xml](phases/03_migrate_users.xml) | 2026-01-07T20:17:34Z |
| Phase 4: Cleanup & Verify | pending | [phases/04_cleanup_verification.xml](phases/04_cleanup_verification.xml) | - |

## Files to Migrate

| Source | Target | Lines | Functions | Types | Status |
|--------|--------|-------|-----------|-------|--------|
| `lib/db-orgs.ts` | `lib/db/orgs.ts` | 266 | 14 | 3 | **completed** |
| `lib/db-wishlist.ts` | `lib/db/wishlist.ts` | 77 | 4 | 0 | **completed** |
| `lib/db-users.ts` | `lib/db/users.ts` | 281 | 13 | 2 | **completed** |

## Critical Issues

- ~~**lib/db-users.ts** defines its own `getSql()` function using `@neondatabase/serverless` directly instead of using the shared connection from `lib/db/connection.ts`. This must be fixed during Phase 3.~~ **RESOLVED in Phase 3** - Duplicate `getSql()` removed, now using shared connection from `lib/db/connection.ts`.

## Consumer Analysis

| Source File | Consumer Count | Key Consumers |
|-------------|----------------|---------------|
| `lib/db-orgs.ts` | 7 | organizations API routes, admin pages |
| `lib/db-users.ts` | 6 | auth routes, admin pages, access-context |
| `lib/db-wishlist.ts` | 1 | wishlist API route |

## Next Action

Execute **[phases/04_cleanup_verification.xml](phases/04_cleanup_verification.xml)** to perform final cleanup and verification of the database refactoring.

---

## Execution Log

### 2026-01-07T20:17:34Z - Phase 3: Migrate Users (Critical Fix)

**Prompt**: `phases/03_migrate_users.xml`
**Status**: completed

**Critical Fix Applied**: Removed duplicate `getSql()` function that was defined locally in `lib/db-users.ts`. Now uses shared `getSql` from `lib/db/connection.ts`.

**Deliverables**:
- Added `DashboardUser` and `Invite` types to `lib/db/types.ts`
- Created `lib/db/users.ts` with 13 exported functions (using `getSql` from `./connection`)
- Updated `lib/db/index.ts` with exports for all user functions and types
- Updated 6 consumer files to import from `@/lib/db`
- Deleted `lib/db-users.ts`

**Consumer Files Updated**:
1. `app/admin/page.tsx` - type imports consolidated
2. `app/api/organizations/[id]/members/route.ts` - getUserByEmail import moved to @/lib/db
3. `app/api/admin/invites/route.ts` - all user imports consolidated with addOrganizationMember
4. `components/auth/access-context.tsx` - DashboardUser type import
5. `app/api/admin/users/route.ts` - all user imports moved to @/lib/db
6. `app/api/auth/check-access/route.ts` - checkUserAccess import moved to @/lib/db

**Functions Migrated** (13 exported):
- User queries: `getUserByEmail`, `getAllUsers`, `createUser`, `updateUserRole`, `deleteUser`
- Invite queries: `getInviteByEmail`, `getAllInvites`, `createInvite`, `markInviteAsUsedById`, `markInviteAsUsed`, `deleteInvite`
- Auth helpers: `checkUserAccess`, `isAdmin`
- Private helpers (not exported): `getDefaultOrgId`, `createUserFromInvite`

**Types Added**:
- `DashboardUser` - Dashboard user entity (id, email, role, invited_by, default_org_id, created_at, updated_at)
- `Invite` - Invite entity (id, email, role, invited_by, organization_id, used, created_at)

**Verification**:
- Build passed before and after deletion of original file
- Confirmed only one `getSql()` function exists in codebase (in `lib/db/connection.ts`)

---

### 2026-01-07T20:11:43Z - Phase 2: Migrate Wishlist

**Prompt**: `phases/02_migrate_wishlist.xml`
**Status**: completed

**Deliverables**:
- Created `lib/db/wishlist.ts` with 4 functions (import path fixed to `./connection`)
- Updated `lib/db/index.ts` with exports for all wishlist functions
- Updated 1 consumer file to import from `@/lib/db`
- Deleted `lib/db-wishlist.ts`

**Consumer Files Updated**:
1. `app/api/wishlist/route.ts` - import changed from `@/lib/db-wishlist` to `@/lib/db`

**Functions Migrated**:
- `addToWishlist(email, name?)` - Add email to wishlist with duplicate check
- `isEmailInWishlist(email)` - Check if email exists
- `getWishlistEntries()` - Get all entries (admin)
- `getWishlistCount()` - Get total count

**Verification**: Build passed before and after deletion of original file

---

### 2026-01-07T20:06:44Z - Phase 1: Migrate Organizations

**Prompt**: `phases/01_migrate_orgs.xml`
**Status**: completed

**Deliverables**:
- Created `lib/db/orgs.ts` with 14 functions (import path fixed to `./connection`)
- Added 3 types to `lib/db/types.ts`: `Organization`, `OrganizationMember`, `OrganizationWithRole`
- Updated `lib/db/index.ts` with exports for all org functions and types
- Updated 7 consumer files to import from `@/lib/db`
- Deleted `lib/db-orgs.ts`

**Consumer Files Updated**:
1. `app/admin/page.tsx` - type import
2. `app/api/organizations/route.ts`
3. `app/api/organizations/[id]/route.ts`
4. `app/api/organizations/[id]/members/route.ts`
5. `app/api/organizations/[id]/members/[userId]/route.ts`
6. `app/api/admin/invites/route.ts`
7. `app/api/admin/organizations/route.ts`

**Verification**: Build passed before and after deletion of original file

---

### 2026-01-07T20:01:17Z - Investigation Phase

**Prompt**: `investigation/prompt.xml`
**Status**: completed

**Deliverables Created**:
- `investigation/analysis.md` - Full analysis with function inventory, consumers, and design decisions
- `phases/01_migrate_orgs.xml` - Organizations module migration prompt
- `phases/02_migrate_wishlist.xml` - Wishlist module migration prompt
- `phases/03_migrate_users.xml` - Users module migration prompt (critical fix)
- `phases/04_cleanup_verification.xml` - Final cleanup and verification prompt

**Key Findings**:
- 32 functions to migrate across 3 files
- 5 types to add to `lib/db/types.ts`
- 14 consumer files to update
- `lib/db-users.ts` has duplicate `getSql()` - must fix
- 3 functions identified for `getQueriesForOrg()`: `getOrganizationMembers`, `getOrgInvites`, `isUserMemberOfOrg`

**Decisions Made**:
1. Types will be centralized in `lib/db/types.ts`
2. Wishlist remains global (not org-bound) - marketing feature
3. User functions remain global - users span organizations
