# Exolar QA - E2E Test Dashboard

## What It Is

A dashboard for monitoring Playwright test executions in real-time. It provides comprehensive analytics, failure analysis, and integrates directly with Claude Code for AI-assisted debugging.

## Key Capabilities

### Test Monitoring

- **Real-time execution tracking** - View pass/fail/flaky rates as tests run
- **Branch & suite filtering** - Focus on specific test areas
- **Test search with history** - Find any test and see its run history

### Analytics & Metrics

- **Reliability Score** - Single 0-100 gauge showing test suite health
- **Performance regression detection** - Automatic alerts when tests slow down
- **Flakiness tracking** - Identify and monitor unreliable tests
- **Trend charts** - Visualize test health over time

### Failure Analysis

- **AI context for failures** - Structured information to help debug issues
- **Error distribution charts** - See patterns in failure types
- **Comparative run analysis** - Compare two executions side-by-side to spot regressions

### Artifacts

- **Video recordings** - Watch test failures
- **Trace files** - Step-by-step Playwright traces
- **Screenshots** - Failure snapshots

### Claude Code Integration (MCP)

Query test data directly from Claude Code:

- Get failed tests with context
- Search test history
- Compare executions
- Analyze flaky tests

## Benefits

| Benefit | Impact |
|---------|--------|
| **Faster debugging** | AI context + artifacts reduce investigation time |
| **Early regression detection** | Performance alerts catch slowdowns before production |
| **Flakiness visibility** | Stop wasting time on unreliable tests |
| **No infrastructure** | Serverless on Neon + Vercel |

## Access

**Dashboard:** https://e2e-test-dashboard.vercel.app

**Docs:** https://e2e-test-dashboard.vercel.app/docs
