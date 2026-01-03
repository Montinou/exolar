# @exolar-qa/playwright-reporter

A Playwright reporter that automatically uploads test results to your [Exolar QA](https://exolar.qa) E2E Test Dashboard.

## Features

- Automatic CI detection (only sends in CI environments)
- AI-enriched failure context for intelligent debugging
- Screenshot, video, and trace upload support
- Zero-config with environment variables
- TypeScript support with full type definitions

## Installation

```bash
npm install -D @exolar-qa/playwright-reporter
# or
yarn add -D @exolar-qa/playwright-reporter
# or
pnpm add -D @exolar-qa/playwright-reporter
```

## Quick Start

### 1. Get Your API Key

1. Log into your [Exolar dashboard](https://exolar.qa)
2. Go to **Settings > API Keys**
3. Click **Create API Key**
4. Copy the key (starts with `exolar_`)

### 2. Add to GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:

| Secret | Value |
|--------|-------|
| `EXOLAR_API_KEY` | Your API key from step 1 |

### 3. Configure Playwright

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { exolar } from "@exolar-qa/playwright-reporter";

export default defineConfig({
  reporter: [
    ["html"],
    [exolar, {
      // API key - reads from EXOLAR_API_KEY env var by default
      apiKey: process.env.EXOLAR_API_KEY,
    }]
  ],

  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
```

### 4. Update GitHub Actions

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          EXOLAR_API_KEY: ${{ secrets.EXOLAR_API_KEY }}
```

## Configuration Options

```typescript
[exolar, {
  // API key for authentication
  // Default: process.env.EXOLAR_API_KEY
  apiKey: "exolar_...",

  // Dashboard endpoint (for self-hosted)
  // Default: process.env.EXOLAR_URL || "https://exolar.qa"
  endpoint: "https://your-dashboard.com",

  // Only send results when there are failures
  // Default: false
  onlyOnFailure: true,

  // Include screenshots, videos, traces
  // Default: true
  includeArtifacts: true,

  // Maximum artifact size in bytes (skip larger files)
  // Default: 5MB (5 * 1024 * 1024)
  maxArtifactSize: 10 * 1024 * 1024,

  // Disable the reporter entirely
  // Default: false
  disabled: false,
}]
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXOLAR_API_KEY` | API key for authentication | Required |
| `EXOLAR_URL` | Dashboard endpoint URL | `https://exolar.qa` |
| `CI` | Auto-detected in CI environments | - |
| `GITHUB_ACTIONS` | Auto-detected in GitHub Actions | - |

### GitHub Actions Variables (Auto-detected)

The reporter automatically captures these GitHub Actions variables:

- `GITHUB_RUN_ID` - Unique workflow run identifier
- `GITHUB_HEAD_REF` - PR source branch (preferred)
- `GITHUB_REF_NAME` - Ref name (fallback)
- `GITHUB_SHA` - Commit SHA
- `GITHUB_ACTOR` - User who triggered the workflow
- `GITHUB_WORKFLOW` - Workflow name
- `TEST_SUITE_NAME` - Optional suite name (set manually)

## Local Development

The reporter is automatically disabled in local development (non-CI environments).

For failed tests, it still exports AI-enriched context to `test-results/ai-failures/` for debugging with AI coding assistants.

## AI Context Export

When tests fail, the reporter creates JSON files with AI-enriched context:

```
test-results/
  ai-failures/
    tests_login_spec_ts__should_login_successfully.json
```

This context includes:
- Error message and type
- Stack trace with location
- Test steps leading to failure
- Last API call (if captured)
- Page URL
- Relevant logs

AI coding assistants like Claude Code can use this context for intelligent debugging.

## Troubleshooting

### "No results appearing in dashboard"

1. Verify `EXOLAR_API_KEY` is set in your CI environment
2. Check CI logs for `[Exolar] Initialized` message
3. Ensure the API key is valid (starts with `exolar_`)

### "Artifacts not uploading"

1. Check artifact sizes against `maxArtifactSize` limit
2. Verify your Playwright config captures screenshots/videos
3. Look for `[Exolar] Skipping artifact` messages in logs

### "Reporter disabled locally"

This is expected behavior. The reporter only activates in CI to avoid cluttering local development.

To test locally, set `CI=true`:
```bash
CI=true npx playwright test
```

## License

MIT
