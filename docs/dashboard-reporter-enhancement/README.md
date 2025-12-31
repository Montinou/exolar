# Dashboard Reporter Enhancement

## Overview

This enhancement adds AI-friendly failure context to the existing E2E test infrastructure without requiring a separate reporter. The implementation cherry-picks the most valuable features from the ai-failure-logging proposal while leveraging existing infrastructure.

## Goals

1. **Local JSON Export on Failure** - Write structured failure context to `ai-failures/{testId}.json` for immediate Claude Code consumption
2. **JSONB Database Storage** - Add `ai_context` column to `test_results` table for queryable failure analysis
3. **Test Logger Rollout** - Add `logger.info()` calls to all 62 test files currently without logging

## Current State

| Component | Status |
|-----------|--------|
| Dashboard Reporter | Production-ready, captures logs/errors/artifacts |
| TestLogger | Fully implemented, used in 5/67 test files |
| Database | JSONB support exists (logs column) |
| E2E Test Dashboard | Receives and displays test results |

## Enhancement Scope

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 1 | Database schema migration (add ai_context JSONB) | 15 min |
| Phase 2 | Local JSON export on failure (~30 lines) | 30 min |
| Phase 3 | Dashboard integration (types, validation, db.ts) | 45 min |
| Phase 4 | Test logger rollout (62 test files) | 2-3 hours |

## Files Modified

### Phase 1 (Database)
- `scripts/008_add_ai_context.sql` (new)

### Phase 2 (Reporter)
- `attorney_share_mvp_web/automation/playwright/reporters/dashboard-reporter.ts`

### Phase 3 (Dashboard)
- `e2e-test-dashboard/lib/types.ts`
- `e2e-test-dashboard/lib/validation.ts`
- `e2e-test-dashboard/lib/db.ts`
- `e2e-test-dashboard/app/api/test-results/route.ts`

### Phase 4 (Tests)
- 62 test files across 15+ test categories

## What We're NOT Implementing

- Separate ai-failure-reporter.ts (unnecessary complexity)
- Diagnosis engine (Claude Code can classify errors itself)
- Pattern-based error hints (not essential)

## Implementation Order

Execute phases in order. Each phase has its own XML prompt with detailed implementation steps.

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
   ↓         ↓         ↓         ↓
Database  Reporter  Dashboard   Tests
```

## Success Criteria

- [ ] Failed tests generate local JSON files in `ai-failures/`
- [ ] Dashboard stores `ai_context` JSONB for failed tests
- [ ] All 67 test files have meaningful logging
- [ ] Claude Code can read failure context without manual log parsing
