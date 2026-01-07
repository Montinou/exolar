# Phase 08: Console.log Migration

> **Priority:** High | **Complexity:** Medium | **Dependencies:** Phase 03 (TestLogger Service)
>
> Systematic migration of 4,294 console.log statements across 147 files to use the unified TestLogger service.

---

## Current State Analysis

| Metric | Count |
|--------|-------|
| Total console statements | 4,294 |
| Files affected | 147 |
| Page Objects | ~24 files |
| Utilities | ~38 files |
| Test Specs | ~85+ files |

### Top Files by Console Usage

| File | Count | Priority |
|------|-------|----------|
| `page-objects/PO_MarketplaceV2.ts` | 146 | High |
| `services/case-generator-service.ts` | 53 | High |
| `utils/waterfall-helper.ts` | 91 | High |
| `utils/negotiation-helper.ts` | 87 | High |
| `page-objects/PO_CaseV2.ts` | 83 | High |
| `tests/lead-score/tooltip-interactions.spec.ts` | 135 | Medium |
| `tests/marketplace-v2/marketplace-sorting.spec.ts` | 82 | Medium |
| `page-objects/PO_payments.ts` | 17 | Medium |

---

## Migration Strategy

### Approach: Phased, Non-Breaking Migration

The migration should be:
1. **Incremental** - File by file, not all at once
2. **Non-breaking** - Existing tests continue to work
3. **Prioritized** - Start with most-used files
4. **Validated** - Verify console output locally before each merge

### Phase 8a: Core Infrastructure (Page Objects & Services)

**Priority: Critical** | Files: ~15 | Estimated console.log: ~500+

1. `page-objects/BasePage.ts` - Add logger support
2. `page-objects/PO_CaseV2.ts` - Migrate (83 logs)
3. `page-objects/PO_MarketplaceV2.ts` - Migrate (146 logs)
4. `page-objects/PO_signin.ts` - Migrate (29 logs)
5. `services/case-generator-service.ts` - Migrate (53 logs)
6. `services/case-rejection-service.ts` - Migrate (23 logs)
7. `services/smart-cleanup-service.ts` - Migrate (4 logs)

### Phase 8b: Utilities (High-Impact)

**Priority: High** | Files: ~20 | Estimated console.log: ~600+

1. `utils/waterfall-helper.ts` - Migrate (91 logs)
2. `utils/negotiation-helper.ts` - Migrate (87 logs)
3. `utils/payment-update-helper.ts` - Migrate (65 logs)
4. `utils/lead-score-helper.ts` - Migrate (60 logs)
5. `utils/my-referrals-helper.ts` - Migrate (57 logs)
6. `utils/signed-status-helper.ts` - Migrate (56 logs)
7. `utils/cleanup/data-cleanup.ts` - Migrate (63 logs)
8. Other utilities as needed

### Phase 8c: Test Specifications (Lower Priority)

**Priority: Medium** | Files: ~85+ | Estimated console.log: ~3000+

- Can be migrated gradually over time
- Focus on frequently failing tests first
- Direct console.log in tests can remain longer (less critical)

---

## Migration Pattern

### Before (Current Pattern)

```typescript
// Page Object
export class PO_CaseV2 {
  async createCase(fee: number): Promise<string> {
    console.log('🔐 Creating case with fee:', fee);
    // ... implementation
    console.log('✅ Case created:', caseId);
    return caseId;
  }
}

// Test Spec
test('should create case', async ({ page }) => {
  console.log('Starting test');
  const casePage = new PO_CaseV2(page);
  // ...
});
```

### After (New Pattern)

```typescript
// Page Object
import { BasePage } from './BasePage';

export class PO_CaseV2 extends BasePage {
  async createCase(fee: number): Promise<string> {
    this.log('Creating case', { fee });
    // ... implementation
    this.log('Case created', { caseId });
    return caseId;
  }
}

// Test Spec
import { test } from '../fixtures/logger-fixture';

test('should create case', async ({ page, logger }) => {
  logger.info('test', 'Starting test');
  const casePage = new PO_CaseV2(page, logger);
  // ...
});
```

---

## Search & Replace Patterns

### Pattern 1: Simple console.log

```typescript
// Before
console.log('Message');

// After
this.log('Message');
```

### Pattern 2: console.log with data

```typescript
// Before
console.log('Creating case with fee:', fee);
console.log('Found', count, 'elements');

// After
this.log('Creating case', { fee });
this.log('Found elements', { count });
```

### Pattern 3: Emoji-prefixed logs

```typescript
// Before
console.log('🔐 Authenticating user...');
console.log('✅ Case created:', caseId);
console.log('❌ Failed:', error);

// After (emojis removed, structured data)
this.log('Authenticating user');
this.log('Case created', { caseId });
this.logError('Failed', error);
```

### Pattern 4: console.error

```typescript
// Before
console.error('Operation failed:', error);

// After
this.logError('Operation failed', error);
```

### Pattern 5: console.warn

```typescript
// Before
console.warn('⚠️ Element not found');

// After
this.logWarn('Element not found');
```

### Pattern 6: Template literals

```typescript
// Before
console.log(`Found ${count} cases in ${duration}ms`);

// After
this.log('Found cases', { count, duration });
```

---

## Validation Checklist

### Per-File Migration

- [ ] File extends BasePage or receives logger
- [ ] All console.log replaced with this.log()
- [ ] All console.warn replaced with this.logWarn()
- [ ] All console.error replaced with this.logError()
- [ ] No emoji characters in log messages
- [ ] Data passed as structured object, not string concatenation
- [ ] Run test locally - verify structured output
- [ ] Run test with CI=true - verify silent capture

### Global Validation

- [ ] All page objects extend BasePage with logger
- [ ] Logger fixture available in test specs
- [ ] No TypeScript errors
- [ ] Tests pass locally
- [ ] Tests pass in CI

---

## Migration Priority Order

### Week 1: Foundation

1. Create/update `BasePage.ts` with logger support
2. Create logger fixture
3. Migrate `PO_signin.ts` (pilot - 29 logs)
4. Migrate `PO_CaseV2.ts` (83 logs)
5. Validate with local + CI runs

### Week 2: Page Objects

1. `PO_MarketplaceV2.ts` (146 logs)
2. `PO_payments.ts` (17 logs)
3. `PO_MyReferrals.ts` (1 log)
4. `PO_WaterfallReferrals.ts` (10 logs)
5. `PO_CreateWaterfallForm.ts` (23 logs)
6. Remaining page objects

### Week 3: Services & High-Impact Utilities

1. `case-generator-service.ts` (53 logs)
2. `waterfall-helper.ts` (91 logs)
3. `negotiation-helper.ts` (87 logs)
4. `payment-update-helper.ts` (65 logs)
5. `lead-score-helper.ts` (60 logs)

### Week 4: Remaining Utilities

1. Complete remaining utilities
2. Begin test spec migration (priority: frequently failing)

### Ongoing: Test Specs

- Migrate test specs gradually as they're touched
- Focus on tests that fail in CI first

---

## Automated Migration Script (Optional)

A script could automate simple replacements:

```bash
# WARNING: Review all changes before committing!

# Pattern: console.log('message')  →  this.log('message')
sed -i '' "s/console\.log('\([^']*\)')/this.log('\1')/g" file.ts

# Pattern: console.error('message', error)  →  this.logError('message', error)
sed -i '' "s/console\.error('\([^']*\)',\s*\(.*\))/this.logError('\1', \2)/g" file.ts
```

**Important**: Automated scripts only handle simple cases. Complex patterns (template literals, multiple arguments) require manual migration.

---

## Metrics & Tracking

### Before Migration

- Total console.* statements: 4,294
- Files with console.*: 147

### Target After Migration

- console.* in page-objects/: 0
- console.* in services/: 0
- console.* in utils/: 0
- console.* in fixtures/: 0
- console.* in tests/: Reduced (gradual)

### Progress Tracking

| Phase | Files | Console.log | Status |
|-------|-------|-------------|--------|
| 8a: Page Objects & Services | 15 | ~500 | Pending |
| 8b: Utilities | 20 | ~600 | Pending |
| 8c: Test Specs | 85+ | ~3000 | Pending |

---

## Notes

### Backward Compatibility

- `console.log` still works during migration
- Tests won't break if some files aren't migrated
- Migration is additive, not destructive

### Don't Remove

Some console.* statements should remain:
- Debug scripts (`scripts/*.ts`) - one-off utilities
- Setup scripts for local development
- Error handling in global-setup/teardown (may want to keep visible)

### Testing the Logger

```bash
# Run test locally - should see structured console output
npx playwright test tests/example.spec.ts

# Simulate CI - should capture silently (errors only)
CI=true npx playwright test tests/example.spec.ts
```

---

## Next Steps

After completing this phase:
1. Monitor dashboard for structured logs
2. Analyze failure context quality
3. Identify remaining unmigrated files
4. Continue gradual migration of test specs

---

*Phase 08 enables full structured logging across the test infrastructure*
