# Exolar QA — Technical Overview

## Architecture

Next.js 16 App Router monorepo deployed on Vercel. PostgreSQL via NeonDB with pgvector
extension for vector search. Cloudflare R2 for artifact storage (videos, traces,
screenshots). Upstash Redis for rate limiting (60 req/min per IP, applied at middleware).
Multi-tenant: all data isolated per organization via Row-Level Security.

## Database

27 migration files (scripts/001 through 027). RLS policies enforce org-level isolation
across all tables. test_results rows carry 3 pgvector columns: error embedding, stack
trace embedding, and semantic cluster centroid. Indexes optimized for execution + org
filtering.

## Packages

- `@exolar-qa/playwright-reporter` v1.0.0 — Playwright reporter that ships test results,
  retry history, DOM snapshots, network logs, and Linear ticket IDs to the ingestion API.
  Auto-detects Linear tickets from branch names (e.g. `feature/ENG-123-login`).
- `@exolar-qa/mcp-server` v1.0.0 — Standalone MCP server exposing 5 consolidated tools
  and 16 datasets. Mirrors the hosted `/api/mcp` endpoint for local use.

## API Surface

| Group | Endpoints |
|---|---|
| Ingestion | `POST /api/test-results` (API key auth) |
| Executions | `GET /api/executions`, `GET /api/executions/[id]` |
| Metrics | `GET /api/metrics`, `GET /api/trends`, `GET /api/flakiness` |
| Tests | `GET /api/search`, `GET /api/tests/[signature]` |
| Artifacts | `GET /api/artifacts/[id]/signed-url` |
| CI Pipeline | `POST /api/ci/analyze`, `POST /api/ci/webhooks` |
| MCP | `GET /api/mcp` (health), `POST /api/mcp` (JSON-RPC) |
| Organizations | `GET/POST /api/organizations`, `GET/PATCH/DELETE /api/organizations/[id]` |
| Members | `GET/POST /api/organizations/[id]/members`, `PATCH/DELETE .../members/[userId]` |
| Admin | `GET /api/admin/organizations`, `GET/POST/DELETE /api/admin/users`, `.../invites` |

## AI Features

Embeddings via Jina v3 (`jina-embeddings-v3`). Each test failure is embedded on ingest.
Semantic clustering groups failures by similarity — surfaces root cause counts ("50
failures → 3 issues"). Natural language search via `/api/search` and the `semantic_search`
MCP dataset. Failure classification: `HEALABLE`, `REAL_BUG`, `KNOWN_FLAKE`, `INFRA`.
Decision matrix weighs error type, retry count, historical flakiness rate, and cluster
membership.

## CI Pipeline (v2.4)

- `POST /api/ci/analyze` — classifies failures with confidence score, returns per-test
  verdict and recommended action.
- Auto-heal: 5 fix strategies (`selector_update`, `wait_adjustment`, `race_condition`,
  `api_timing`, `retry_logic`). Generates fix instructions consumed by Claude Code or
  OpenClaw agents, which open PRs automatically.
- Auto-bug-report: REAL_BUG failures are filed as GitHub issues with full context (stack
  trace, cluster, affected tests). Deduplication prevents spam.
- Webhook notifier: `POST /api/ci/webhooks` with HMAC-SHA256 signing, event filtering,
  and branch-based routing.
- Linear integration: links tests to tickets via reporter config or branch name
  auto-detection; fetches acceptance criteria to distinguish test issues from real bugs.

## Test Coverage

57 unit tests (vitest) covering: analysis engine, auto-heal strategies, webhook notifier,
bug reporter, and Linear integration modules. Located in `tests/`.

## Ecosystem

- **Triqual** — test automation plugin that consumes the reporter package and ingestion API.
- **Quoth** — AI memory and A2A bus; Exolar feeds failure vectors into Quoth for cross-agent
  knowledge sharing and persistent test intelligence.
