# TOOLS.md — Exolar Sentinel

## MCP Servers

### exolar-qa
- **URL**: `https://exolar.triqual.dev/api/mcp/mcp`
- **Auth**: Bearer token via `EXOLAR_MCP_TOKEN`
- **Purpose**: Primary interface to the Exolar platform

Tools used:
- `ci_get_analysis` — fetch classified failure list for an `execution_id`
- `ci_get_failure_detail` — full `AIFailureContext`, stack trace, selector snapshots
- `ci_update_auto_heal_attempt` — write attempt record (status, patch diff, PR URL)
- `ci_create_auto_bug` — create a structured bug record linked to `execution_id`
- `ci_get_org_rate_limit` — check remaining auto-heal quota for the org
- `analytics_get_flake_history` — query historical flake data for a test ID
- `analytics_get_root_cause_cluster` — find matching cluster for deduplication

### quoth
- **URL**: `https://quoth.triqual.dev/api/mcp`
- **Auth**: Bearer token via `QUOTH_MCP_TOKEN`
- **Purpose**: Pattern knowledge base — search proven fixes, propose new learnings

Tools used:
- `quoth_search_patterns` — find fix patterns by `error_type`, `selector_hint`, `framework`
- `quoth_get_pattern` — retrieve full pattern with example diffs
- `quoth_propose_update` — submit new pattern after a successful auto-heal
- `quoth_get_confidence` — get confidence score for a candidate fix strategy

### linear
- **URL**: `https://mcp.linear.app/sse`
- **Auth**: Linear API key via `LINEAR_API_KEY`
- **Purpose**: Fetch ticket context to validate fixes against acceptance criteria

Tools used:
- `linear_get_issue` — fetch issue description, acceptance criteria, status
- `linear_add_comment` — annotate ticket when a real bug is confirmed or PR is opened

## Builtin Tools

### git
- Clone, pull, checkout, commit, push
- Branch naming: `exolar/auto-heal-{run_id}`
- Never push to `main` or `master`

### github
- `create_pull_request` — open PR with structured body (failure summary, fix strategy, test evidence)
- `create_issue` — structured bug report with reproduction steps and CI context
- `list_issues` — deduplicate before creating new bug reports (search by `root_cause_cluster` label)
- `add_labels` — tag issues with `auto-detected`, `playwright`, `exolar-sentinel`

### web
- Fetch Playwright docs for selector API reference when building fixes
- Read package.json / playwright.config.ts from repo to understand project setup

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `EXOLAR_MCP_TOKEN` | Exolar QA MCP authentication |
| `QUOTH_MCP_TOKEN` | Quoth pattern MCP authentication |
| `LINEAR_API_KEY` | Linear ticket access |
| `GITHUB_TOKEN` | PR and issue creation |
| `OPENCLAW_A2A_TOKEN` | a2a messaging to Morfeo / Prometeo |
