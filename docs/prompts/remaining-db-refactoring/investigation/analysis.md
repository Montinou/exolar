# Database Refactoring Investigation Analysis

## Executive Summary

Three standalone database files (`lib/db-orgs.ts`, `lib/db-wishlist.ts`, `lib/db-users.ts`) need to be migrated into the modular `lib/db/` structure. The critical issue is that `lib/db-users.ts` defines its own `getSql()` function, creating a duplicate connection instead of using the shared connection from `lib/db/connection.ts`.

---

## File Inventory

### 1. lib/db-orgs.ts (266 lines)

**Import Status**: ✅ Uses `getSql()` from `"./db"` (correct)

**Types Defined** (3):
- `Organization` - Core org entity (id, name, slug, created_by, timestamps)
- `OrganizationMember` - Membership with role (owner/admin/viewer)
- `OrganizationWithRole` - Organization with user's role attached

**Functions** (14):

| Function | Description | Org-Bound? |
|----------|-------------|------------|
| `createOrganization` | Create org and add creator as owner | No - admin |
| `getOrganizationById` | Get org by ID | No - lookup |
| `getOrganizationBySlug` | Get org by slug | No - lookup |
| `updateOrganization` | Update org name/slug | No - admin |
| `deleteOrganization` | Delete org | No - admin |
| `getAllOrganizations` | List all orgs (admin) | No - admin |
| `getOrganizationMembers` | List members of org | **Yes** - good candidate |
| `addOrganizationMember` | Add user to org | No - admin |
| `updateMemberRole` | Change member role | No - admin |
| `removeMember` | Remove user from org | No - admin |
| `getUserOrganizations` | Get orgs a user belongs to | No - user-centric |
| `isUserMemberOfOrg` | Check membership | **Maybe** - useful in context |
| `createOrgInvite` | Create org-specific invite | No - admin |
| `getOrgInvites` | Get pending org invites | **Yes** - good candidate |

---

### 2. lib/db-wishlist.ts (77 lines)

**Import Status**: ✅ Uses `getSql()` from `"./db"` (correct)

**Types Defined**: None (uses inline return types)

**Functions** (4):

| Function | Description | Org-Bound? |
|----------|-------------|------------|
| `addToWishlist` | Add email to waitlist | No - global |
| `isEmailInWishlist` | Check if email exists | No - global |
| `getWishlistEntries` | List all entries (admin) | No - global |
| `getWishlistCount` | Count entries | No - global |

**Note**: Wishlist is a global marketing feature, not org-bound.

---

### 3. lib/db-users.ts (281 lines)

**Import Status**: ❌ **DEFINES OWN `getSql()`** - CRITICAL ISSUE

```typescript
import { neon } from "@neondatabase/serverless"

function getSql() {
  return neon(process.env.DATABASE_URL!)
}
```

This creates a duplicate database connection instead of using `lib/db/connection.ts`.

**Types Defined** (2):
- `DashboardUser` - User entity (id, email, role, invited_by, default_org_id, timestamps)
- `Invite` - Invite entity (id, email, role, invited_by, organization_id, used, timestamps)

**Functions** (14):

| Function | Visibility | Description |
|----------|------------|-------------|
| `getUserByEmail` | Public | Get user by email |
| `getAllUsers` | Public | List all users (admin) |
| `createUser` | Public | Create new user |
| `updateUserRole` | Public | Change user role |
| `deleteUser` | Public | Delete user |
| `getInviteByEmail` | Public | Get invite by email |
| `getAllInvites` | Public | List all invites (admin) |
| `createInvite` | Public | Create invite |
| `markInviteAsUsedById` | Public | Mark invite used by ID |
| `markInviteAsUsed` | Public | Mark invite used by email |
| `deleteInvite` | Public | Delete invite |
| `getDefaultOrgId` | **Private** | Get default org ID |
| `createUserFromInvite` | **Private** | Create user from invite |
| `checkUserAccess` | Public | Auth check + auto-create from invite |
| `isAdmin` | Public | Check if user is admin |

---

## Consumer Analysis

### lib/db-orgs.ts Consumers (7 files)

| File | Imports |
|------|---------|
| `app/admin/page.tsx` | `Organization` (type) |
| `app/api/organizations/route.ts` | `getUserOrganizations`, `createOrganization`, `getOrganizationBySlug` |
| `app/api/organizations/[id]/members/[userId]/route.ts` | `updateMemberRole`, `removeMember` |
| `app/api/organizations/[id]/members/route.ts` | `getOrganizationMembers`, `addOrganizationMember`, `getOrganizationById`, `isUserMemberOfOrg` |
| `app/api/organizations/[id]/route.ts` | `getOrganizationById`, `updateOrganization`, `deleteOrganization` |
| `app/api/admin/invites/route.ts` | `addOrganizationMember` |
| `app/api/admin/organizations/route.ts` | `getAllOrganizations` |

### lib/db-users.ts Consumers (6 files)

| File | Imports |
|------|---------|
| `app/admin/page.tsx` | `DashboardUser`, `Invite` (types) |
| `app/api/organizations/[id]/members/route.ts` | `getUserByEmail` |
| `app/api/admin/invites/route.ts` | `isAdmin`, `getAllInvites`, `createInvite`, `deleteInvite`, `getUserByEmail`, `createUser` |
| `components/auth/access-context.tsx` | `DashboardUser` (type) |
| `app/api/admin/users/route.ts` | `isAdmin`, `getAllUsers`, `updateUserRole`, `deleteUser`, `getUserByEmail` |
| `app/api/auth/check-access/route.ts` | `checkUserAccess` |

### lib/db-wishlist.ts Consumers (1 file)

| File | Imports |
|------|---------|
| `app/api/wishlist/route.ts` | `addToWishlist` |

---

## Target Structure Design

### New Files

```
lib/db/
├── connection.ts        # Existing - shared getSql()
├── types.ts             # Add: Organization, OrganizationMember, etc.
├── orgs.ts              # NEW - from lib/db-orgs.ts
├── wishlist.ts          # NEW - from lib/db-wishlist.ts
├── users.ts             # NEW - from lib/db-users.ts
├── index.ts             # Update exports
└── ... (existing modules)
```

### Types Placement

Add to `lib/db/types.ts`:
- `Organization`
- `OrganizationMember`
- `OrganizationWithRole`
- `DashboardUser`
- `Invite`

### Import Updates Required

Each new module will:
1. Import `getSql` from `"./connection"` (not `"./db"` or direct neon)
2. Import types from `"./types"` (or define inline and export)

### Index.ts Exports to Add

```typescript
// Organization operations
export {
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization,
  getAllOrganizations,
  getOrganizationMembers,
  addOrganizationMember,
  updateMemberRole,
  removeMember,
  getUserOrganizations,
  isUserMemberOfOrg,
  createOrgInvite,
  getOrgInvites,
} from "./orgs"

// User operations
export {
  getUserByEmail,
  getAllUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getInviteByEmail,
  getAllInvites,
  createInvite,
  markInviteAsUsedById,
  markInviteAsUsed,
  deleteInvite,
  checkUserAccess,
  isAdmin,
} from "./users"

// Wishlist operations
export {
  addToWishlist,
  isEmailInWishlist,
  getWishlistEntries,
  getWishlistCount,
} from "./wishlist"

// Types
export type {
  Organization,
  OrganizationMember,
  OrganizationWithRole,
  DashboardUser,
  Invite,
} from "./types"
```

---

## Multi-Tenancy Considerations

### Functions to Add to getQueriesForOrg()

| Function | Rationale |
|----------|-----------|
| `getOrganizationMembers` | Already requires orgId, natural fit |
| `getOrgInvites` | Already requires orgId, natural fit |
| `isUserMemberOfOrg` | Useful for permission checks in org context |

### Functions to Keep Global

| Function | Rationale |
|----------|-----------|
| `getUserOrganizations` | User-centric, not org-centric |
| `getAllOrganizations` | Admin function across all orgs |
| All user functions | Users span orgs, not confined to one |
| All wishlist functions | Global marketing feature |

### Proposed getQueriesForOrg() Addition

```typescript
// Add to getQueriesForOrg():
getOrganizationMembers: () => getOrganizationMembers(organizationId),
getOrgInvites: () => getOrgInvites(organizationId),
isUserMemberOfOrg: (userId: number) => isUserMemberOfOrg(userId, organizationId),
```

---

## Migration Phases

### Phase 1: Migrate lib/db-orgs.ts
1. Create `lib/db/orgs.ts`
2. Update import: `getSql` from `"./connection"`
3. Move types to `lib/db/types.ts`
4. Add exports to `lib/db/index.ts`
5. Update all 7 consumer files
6. Delete `lib/db-orgs.ts`
7. Build verification

### Phase 2: Migrate lib/db-wishlist.ts
1. Create `lib/db/wishlist.ts`
2. Update import: `getSql` from `"./connection"`
3. Add exports to `lib/db/index.ts`
4. Update 1 consumer file
5. Delete `lib/db-wishlist.ts`
6. Build verification

### Phase 3: Migrate lib/db-users.ts (CRITICAL)
1. Create `lib/db/users.ts`
2. **REMOVE duplicate `getSql()`** - import from `"./connection"`
3. Move types to `lib/db/types.ts`
4. Add exports to `lib/db/index.ts`
5. Update all 6 consumer files
6. Delete `lib/db-users.ts`
7. Build verification

### Phase 4: Cleanup & Verification
1. Add org-bound functions to `getQueriesForOrg()`
2. Final build check
3. Verify no remaining imports from old paths
4. Documentation update

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking imports | Run build after each phase |
| Type mismatches | Keep signatures identical |
| Missing exports | Verify all functions exported in index.ts |
| Connection issue (db-users.ts) | Remove duplicate getSql, test immediately |

---

## Files to Create

1. `investigation/analysis.md` - This document
2. `phases/01_migrate_orgs.xml` - Organizations migration
3. `phases/02_migrate_wishlist.xml` - Wishlist migration
4. `phases/03_migrate_users.xml` - Users migration (critical)
5. `phases/04_cleanup_verification.xml` - Final cleanup
