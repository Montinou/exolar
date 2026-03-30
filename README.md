# Exolar QA

**Multi-tenant Playwright test analytics with AI-powered failure analysis, auto-healing, and semantic search.**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Playwright](https://img.shields.io/badge/Playwright-reporter-green)

---

## What It Does

Exolar QA collects Playwright test results from CI, stores them in a multi-tenant PostgreSQL database, and surfaces actionable analytics through a dashboard and MCP server. Beyond passive reporting, Exolar closes the loop: when tests fail in CI, the auto-analysis pipeline classifies failures, dispatches auto-heal instructions for flaky tests, and files GitHub issues for real bugs — with full context attached.

---

## Key Features

**Core Analytics**
- Real-time test execution monitoring with pass rates, durations, and critical failure counts
- Reliability Score (0-100 composite metric) for at-a-glance suite health
- Flaky test detection with statistical analysis and retry history
- Performance regression detection — alerts when tests exceed their baseline duration
- 7-day trend charts for test stability over time

**AI Vector Search**
- Jina v3 embeddings for semantic failure clustering
- Groups 50+ failures into root cause clusters ("50 failures -> 3 issues")
- Natural language test search: find tests by intent, not just file name

**CI Auto-Analysis Pipeline (v2.4)**
- `POST /api/ci/analyze` classifies each failure as `HEALABLE`, `REAL_BUG`, `KNOWN_FLAKE`, or `INFRA` with confidence scoring
- Auto-heal instructions for flaky tests across 5 strategies: selector update, wait adjustment, race condition, API timing, retry logic — applied by Claude Code or OpenClaw agents via PR
- Auto bug reporting to GitHub Issues with error message, stack trace, root cause cluster, and linked Linear ticket; deduplication prevents issue spam
- Webhook notifications per organization with HMAC-SHA256 signing, event filtering, and branch routing
- Linear ticket integration via reporter config or auto-detection from branch names (e.g. `feature/ENG-123-login`); acceptance criteria are used to distinguish test issues from real bugs

**Infrastructure**
- Multi-tenancy with organization-level Row-Level Security
- Cloudflare R2 artifact storage (screenshots, traces, videos) with signed URL generation
- Upstash Redis rate limiting (60 req/min per IP) on the ingestion endpoint
- MCP server for Claude Code integration (5 tools, 16 datasets)

---

## Architecture

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16, React 19, TailwindCSS v4 |
| Database | NeonDB Serverless Postgres with pgvector |
| Auth | Neon Auth (JWT) + org-scoped API keys (`exolar_` prefix, SHA-256 hashed) |
| Cache / Rate limit | Upstash Redis |
| Storage | Cloudflare R2 via AWS SDK |
| Embeddings | Jina v3 (via API) |
| UI Components | shadcn/ui, Recharts, Radix UI |

---

## Ecosystem

Exolar QA is part of a three-product ecosystem for AI-assisted test automation:

```
Quoth (AI memory / pattern store)
    <->
Triqual (Playwright test agents / generation)
    <->
Exolar QA (analytics / failure analysis / auto-heal)
```

Triqual generates and runs Playwright tests. Exolar collects results and feeds failure patterns back. Quoth stores learned patterns so Triqual improves over time.

---

## Quick Start

### 1. Install the reporter

```bash
pnpm add -D @exolar-qa/playwright-reporter
```

### 2. Configure `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [
    ['@exolar-qa/playwright-reporter', {
      apiUrl: 'https://your-exolar-instance.vercel.app',
      apiKey: process.env.EXOLAR_API_KEY,
      projectName: 'my-app',
      // Optional: link tests to Linear tickets
      ticketMapping: {
        'auth/login.spec.ts': 'ENG-123',
      },
    }],
  ],
})
```

### 3. Set environment variables in CI

```bash
EXOLAR_API_KEY=exolar_your_key_here
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@exolar-qa/playwright-reporter` | Playwright reporter that ships test results to the API after each run |
| `@exolar-qa/mcp-server` | stdio MCP proxy for Claude Code — authenticates via JWT, forwards JSON-RPC to `/api/mcp` |

Both packages live under `packages/` in this monorepo.

---

## CI Integration

Configure a webhook under **Settings > Webhooks** to receive a signed POST after each CI run with failures. The payload includes classified failures, auto-heal instructions, and links to filed issues.

For OpenClaw users, the `argus` sentinel agent can subscribe to Exolar webhooks and dispatch auto-heal tasks to the appropriate workspace agent automatically.

---

## API Reference

### Ingestion

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/test-results` | Ingest Playwright results (API key auth) |

### CI Auto-Analysis

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ci/analyze` | Classify failures and generate heal/report actions |
| `GET` | `/api/ci/webhooks` | List webhooks for the current org |
| `POST` | `/api/ci/webhooks` | Create a webhook endpoint |

### Dashboard Data

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/executions` | List test executions |
| `GET` | `/api/executions/[id]` | Execution detail with test results |
| `GET` | `/api/metrics` | Dashboard metrics |
| `GET` | `/api/trends` | Time-series trend data |
| `GET` | `/api/search` | Full-text and semantic test search |
| `GET` | `/api/flakiness` | Flaky test list and statistics |
| `GET` | `/api/artifacts/[id]/signed-url` | Generate R2 signed URL |

### MCP

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mcp` | Health check |
| `POST` | `/api/mcp` | JSON-RPC endpoint (5 tools, 16 datasets) |

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build
pnpm build

# Run tests (57 tests)
pnpm test

# Lint
pnpm lint
```

### Database Migrations

Run SQL scripts in order against your Neon database:

```bash
psql $DATABASE_URL -f scripts/001_create_test_tables.sql
psql $DATABASE_URL -f scripts/003_add_logs_and_signature.sql
psql $DATABASE_URL -f scripts/005_flaky_test_detection.sql
psql $DATABASE_URL -f scripts/007_create_user_tables.sql
psql $DATABASE_URL -f scripts/008_add_ai_context.sql
psql $DATABASE_URL -f scripts/009_add_organizations.sql
psql $DATABASE_URL -f scripts/010_add_rls_policies.sql
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEON_AUTH_JWKS_URL` | Neon Auth JWKS endpoint for JWT validation |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

**Optional (Cloudflare R2 artifacts):**

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |

The dashboard functions without R2 — artifact links are disabled if R2 is not configured.

---

## Documentation

In-app documentation is available at `/docs`:

- `/docs/ci-analysis` — CI Auto-Analysis Pipeline setup and webhook configuration
- `/docs/ci-analysis#auto-heal` — Auto-heal strategies and Claude Code integration
- `/docs/ci-analysis#bug-reports` — Automated GitHub issue creation
- `/docs/ci-analysis#linear` — Linear ticket integration
- `/docs/reporter` — Playwright reporter configuration reference

---

## License

MIT
