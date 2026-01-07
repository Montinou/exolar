# Dashboard Integration XML Prompts

This directory contains structured XML prompts for implementing each phase of the E2E Test Dashboard integration with the Attorney Share Playwright infrastructure.

## Usage

Each XML prompt follows templates from [prompt-engineering/templates/](../../../prompt-engineering/templates/) and provides:

1. **System Context**: Role, expertise, and communication style
2. **Task Definition**: Objectives and success criteria
3. **Project Context**: Existing files, patterns, and constraints
4. **Instructions**: Prioritized step-by-step implementation guide
5. **Specifications**: API schemas, component specs, SQL queries
6. **Checklist**: Implementation verification items

## Prompts

### Foundation Phases (Required First)

| Phase | File | Description |
|-------|------|-------------|
| 01 | [01-data-ingestion-endpoint.xml](./01-data-ingestion-endpoint.xml) | POST `/api/test-results` endpoint |
| 02 | [02-playwright-reporter.xml](./02-playwright-reporter.xml) | Custom Playwright reporter (CI only) |
| 03 | [03-test-logger-service.xml](./03-test-logger-service.xml) | Unified TestLogger service |

### Analytics Phases (After Foundation)

| Phase | File | Description |
|-------|------|-------------|
| 04 | [04-test-signatures-search.xml](./04-test-signatures-search.xml) | Test signatures & search |
| 05 | [05-date-range-filter.xml](./05-date-range-filter.xml) | Date range filtering |
| 06 | [06-flaky-test-detection.xml](./06-flaky-test-detection.xml) | Flaky test detection |
| 07 | [07-failure-rate-metrics.xml](./07-failure-rate-metrics.xml) | Failure rate metrics |

### Migration Phase (Parallel with Foundation)

| Phase | File | Description |
|-------|------|-------------|
| 08 | [08-console-log-migration.xml](./08-console-log-migration.xml) | Migrate 4,294 console.log to TestLogger |

## How to Use These Prompts

1. **Start with Phase 01** - Foundation must be completed first
2. **Copy the XML content** to your AI assistant
3. **Follow the implementation checklist** at the end of each prompt
4. **Verify against success criteria** before moving to next phase

## Project Alignment

These prompts are specifically designed for:

- **Dashboard**: Next.js 16 with App Router, Neon PostgreSQL, Cloudflare R2, shadcn/ui
- **Playwright**: Attorney Share MVP Web with existing 24 page objects, 38+ utilities
- **CI/CD**: GitHub Actions with environment-aware behavior

## Key Design Principles

1. **Unified Logging**: Same structured format in all environments
   - Local: Displayed in console for debugging
   - CI: Captured silently, sent to dashboard

2. **CI-Only Reporting**: Dashboard reporter only active in CI environments

3. **Failure-Focused**: Detailed logs only sent for failed tests

4. **Test Signatures**: MD5 hash for consistent test tracking across runs
