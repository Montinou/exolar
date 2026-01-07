# Remaining Database Refactoring - Status

## Overview

Refactor remaining standalone database files (`lib/db-orgs.ts`, `lib/db-wishlist.ts`, `lib/db-users.ts`) into the modular `lib/db/` structure.

## Current Status: **Investigation Complete**

| Phase | Status | Prompt | Last Updated |
|-------|--------|--------|--------------|
| Investigation | **completed** | [investigation/prompt.xml](investigation/prompt.xml) | 2026-01-07T20:01:17Z |
| Phase 1: Migrate Orgs | pending | [phases/01_migrate_orgs.xml](phases/01_migrate_orgs.xml) | - |
| Phase 2: Migrate Wishlist | pending | [phases/02_migrate_wishlist.xml](phases/02_migrate_wishlist.xml) | - |
| Phase 3: Migrate Users | pending | [phases/03_migrate_users.xml](phases/03_migrate_users.xml) | - |
| Phase 4: Cleanup & Verify | pending | [phases/04_cleanup_verification.xml](phases/04_cleanup_verification.xml) | - |

## Files to Migrate

| Source | Target | Lines | Functions | Types | Status |
|--------|--------|-------|-----------|-------|--------|
| `lib/db-orgs.ts` | `lib/db/orgs.ts` | 266 | 14 | 3 | pending |
| `lib/db-wishlist.ts` | `lib/db/wishlist.ts` | 77 | 4 | 0 | pending |
| `lib/db-users.ts` | `lib/db/users.ts` | 281 | 14 | 2 | pending |

## Critical Issues

- **lib/db-users.ts** defines its own `getSql()` function using `@neondatabase/serverless` directly instead of using the shared connection from `lib/db/connection.ts`. This must be fixed during Phase 3.

## Consumer Analysis

| Source File | Consumer Count | Key Consumers |
|-------------|----------------|---------------|
| `lib/db-orgs.ts` | 7 | organizations API routes, admin pages |
| `lib/db-users.ts` | 6 | auth routes, admin pages, access-context |
| `lib/db-wishlist.ts` | 1 | wishlist API route |

## Next Action

Execute **[phases/01_migrate_orgs.xml](phases/01_migrate_orgs.xml)** to migrate organization operations to `lib/db/orgs.ts`.

---

## Execution Log

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
