no e# Dashboard Integration - Overview

> Master document for integrating the E2E Test Dashboard with Attorney Share Playwright infrastructure.
>
> **Created:** December 2025
> **Status:** MVP + Analytics Basicos

---

## Project Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Hosting** | Vercel | Native Next.js integration, easy Neon setup |
| **Artifact Storage** | Cloudflare R2 | Already configured, S3 compatible, generous free tier |
| **Log Detail** | Solo fallos (Minimalista) | Reduce noise, focus on actionable data |
| **Scope** | MVP + Phases 01-04 | Foundation + core analytics |
| **CI Behavior** | Solo envia datos en CI | Local dev unchanged, CI captures everything |

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYWRIGHT TEST EXECUTION                     │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Test Specs   │───│ Page Objects │───│ TestLogger Service   │ │
│  └──────────────┘   └──────────────┘   └──────────┬───────────┘ │
│                                                    │             │
│                                   ┌────────────────▼───────────┐ │
│                                   │  Custom Dashboard Reporter │ │
│                                   │  - Captures all logs       │ │
│                                   │  - Failure context         │ │
│                                   │  - Screenshots/traces      │ │
│                                   └────────────────┬───────────┘ │
└────────────────────────────────────────────────────┼─────────────┘
                                                     │
                                    Only in CI       │
                                                     ▼
                              ┌───────────────────────────────────┐
                              │   POST /api/test-results          │
                              │   e2e-test-dashboard              │
                              └───────────────────┬───────────────┘
                                                  │
                                                  ▼
                              ┌───────────────────────────────────┐
                              │      Neon PostgreSQL              │
                              │  ┌─────────────────────────────┐  │
                              │  │ test_executions (workflow)  │  │
                              │  │ test_results (individual)   │  │
                              │  │ test_artifacts (screenshots)│  │
                              │  └─────────────────────────────┘  │
                              └───────────────────────────────────┘
                                                  │
                                                  ▼
                              ┌───────────────────────────────────┐
                              │      Dashboard UI                 │
                              │  - Real-time metrics              │
                              │  - Failure analysis               │
                              │  - Historical trends              │
                              └───────────────────────────────────┘
```

### CI vs Local Behavior

| Context | Logging | Dashboard Send | Console Output |
|---------|---------|----------------|----------------|
| **CI (GitHub Actions)** | Structured capture + send | Yes, on completion | Errors only |
| **Local (development)** | Structured capture + display | No | Full visibility |

**Key Principle**: Same structured log format in both environments. The only difference is:
- **CI**: Logs are captured silently and sent to dashboard on test completion
- **Local**: Logs are displayed in console with same format (for debugging)

**Context Detection:**
```typescript
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
```

**Log Format (Both Environments):**
```
+1234ms [page-object:PO_CaseV2] Creating case { fee: 500 }
+2345ms [page-object:PO_CaseV2] Case created { caseId: "ABC123", duration: 1111 }
```

---

## Phase Hierarchy

### Foundation Phases (Required First)

| Phase | Name | File | Priority |
|-------|------|------|----------|
| 01 | Data Ingestion Endpoint | `01-data-ingestion-endpoint.md` | **Critical** |
| 02 | Playwright Reporter | `02-playwright-reporter.md` | **Critical** |
| 03 | TestLogger Service | `03-test-logger-service.md` | **Critical** |

### Analytics Phases (After Foundation)

| Phase | Name | File | Priority |
|-------|------|------|----------|
| 04 | Test Signatures & Search | `04-test-signatures-search.md` | High |
| 05 | Date Range Filter | `05-date-range-filter.md` | High |
| 06 | Flaky Test Detection | `06-flaky-test-detection.md` | High |
| 07 | Failure Rate Metrics | `07-failure-rate-metrics.md` | High |

### Migration Phase (Parallel with Foundation)

| Phase | Name | File | Priority |
|-------|------|------|----------|
| 08 | Console.log Migration | `08-console-log-migration.md` | High |

> **Note**: Phase 08 can run in parallel with Foundation phases. It migrates 4,294 console.log statements across 147 files to use the TestLogger service.

---

## Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Foundation (01-03) | 2 weeks | Data flowing to dashboard |
| Test Signatures (04) | 3-4 days | Test history tracking |
| Date Range (05) | 2-3 days | Date filtering |
| Flaky Detection (06) | 3-4 days | Flakiness tracking |
| Failure Rate (07) | 2 days | Failure metrics |
| **Total** | **3-4 weeks** | **Functional dashboard with analytics** |

---

## Technology Stack

### Dashboard (e2e-test-dashboard)

- **Framework**: Next.js 16 with App Router
- **Database**: Neon PostgreSQL (serverless)
- **Storage**: Cloudflare R2 (S3 compatible)
- **UI**: shadcn/ui + TailwindCSS v4
- **Charts**: Recharts
- **Auth**: neon auth

### Playwright Integration (attorney_share_mvp_web)

- **Test Runner**: Playwright
- **Reporter**: Custom dashboard reporter (CI only)
- **Logging**: TestLogger service (dual mode)
- **Language**: TypeScript

---

## File Structure

### Dashboard Files to Create/Modify

```
e2e-test-dashboard/
├── app/
│   └── api/
│       └── test-results/
│           └── route.ts              # NEW - Data ingestion endpoint
├── lib/
│   ├── db.ts                         # MODIFY - Add insert functions
│   └── types.ts                      # MODIFY - Add request types
└── docs/
    └── dashboard-integration/
        ├── 00-overview.md            # This file
        ├── 01-data-ingestion-endpoint.md
        ├── 02-playwright-reporter.md
        ├── 03-test-logger-service.md
        ├── 04-test-signatures-search.md
        ├── 05-date-range-filter.md
        ├── 06-flaky-test-detection.md
        └── 07-failure-rate-metrics.md
```

### Playwright Files to Create/Modify

```
attorney_share_mvp_web/automation/playwright/
├── reporters/
│   └── dashboard-reporter.ts         # NEW - Custom reporter
├── utils/
│   ├── test-logger.ts                # NEW - Logging service
│   └── failure-context.ts            # NEW - Failure capture
├── fixtures/
│   └── base-fixture.ts               # MODIFY - Inject logger
└── playwright.config.ts              # MODIFY - Add reporter (CI only)
```

---

## Environment Variables

### Dashboard (Vercel)

```env
# Required
DATABASE_URL=postgresql://...@neon.tech/...

# Optional (for artifact storage)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# API Security
API_SECRET_KEY=...  # For authenticating reporter requests
```

### Playwright (GitHub Actions)

```env
# Required for dashboard reporting
DASHBOARD_URL=https://your-dashboard.vercel.app
DASHBOARD_API_KEY=...

# Auto-detected
CI=true
GITHUB_ACTIONS=true
```

---

## Key Design Decisions

### 1. CI-Only Reporting

**Decision**: Dashboard reporter only active in CI environments.

**Rationale**:
- No latency impact during local development
- Local debugging experience unchanged
- CI runs are the source of truth for test health

### 2. Failure-Focused Logging

**Decision**: Detailed logs only sent on test failure.

**Rationale**:
- Reduces data storage costs
- Focuses on actionable information
- Passing tests only send minimal metadata

### 3. Unified TestLogger with Environment-Aware Output

**Decision**: Single logging service with identical structured format, different output destinations.

**Behavior**:
- **Local**: Structured logs displayed in console (full visibility for debugging)
- **CI**: Structured logs captured silently, sent to dashboard on completion

**Rationale**:
- Consistent log format across all environments
- Same debugging experience locally, same data captured in CI
- No code changes needed in page objects
- Replaces scattered `console.log` with structured, searchable logs

### 4. Signature-Based Test Tracking

**Decision**: MD5 hash of `file::testName` for consistent test identification.

**Rationale**:
- Works across renames (file path changes)
- Enables historical tracking
- Required for flakiness detection

---

## Success Criteria

### MVP Complete When:

- [ ] Tests in CI send results to dashboard
- [ ] Dashboard displays test executions
- [ ] Failed tests show error context and logs
- [ ] Screenshots visible for failures

### Analytics Complete When:

- [ ] Test search by name/file works
- [ ] Date range filtering functional
- [ ] Flaky tests identified and highlighted
- [ ] Failure rate trend visible

---

## Quick Links

- [Phase 01: Data Ingestion Endpoint](./01-data-ingestion-endpoint.md)
- [Phase 02: Playwright Reporter](./02-playwright-reporter.md)
- [Phase 03: TestLogger Service](./03-test-logger-service.md)
- [Phase 04: Test Signatures & Search](./04-test-signatures-search.md)
- [Phase 05: Date Range Filter](./05-date-range-filter.md)
- [Phase 06: Flaky Test Detection](./06-flaky-test-detection.md)
- [Phase 07: Failure Rate Metrics](./07-failure-rate-metrics.md)
- [Phase 08: Console.log Migration](./08-console-log-migration.md)

---

*This overview should be updated as phases are completed.*
