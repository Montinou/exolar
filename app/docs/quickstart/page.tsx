import Link from "next/link"
import { CheckCircle, ArrowRight, Copy, Key, Package, Play, Eye } from "lucide-react"

export const metadata = {
  title: "Quick Start - Exolar QA",
  description: "Get your Playwright tests reporting to Exolar QA in 5 minutes",
}

export default function QuickStartPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >Quick Start</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Get your Playwright tests reporting to Exolar QA in under 5 minutes.
          Follow these steps to start seeing your test results in the dashboard.
        </p>
      </div>

      {/* Prerequisites */}
      <section className="p-4 sm:p-6 rounded-xl glass-card">
        <h2 className="text-lg font-semibold mb-2">Prerequisites</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span>A Playwright test project</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span>GitHub repository with Actions enabled</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span>An Exolar QA account (sign up free at the dashboard)</span>
          </li>
        </ul>
      </section>

      {/* Step 1 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
            1
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Get Your API Key</h2>
        </div>
        <div className="pl-11 space-y-4">
          <p className="text-muted-foreground">
            Create an API key to authenticate your CI pipeline with Exolar QA.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Go to <Link href="/settings/api-keys" className="text-primary hover:underline">Settings &rarr; API Keys</Link></li>
            <li>Click <strong className="text-foreground">&quot;Create API Key&quot;</strong></li>
            <li>Give it a descriptive name (e.g., &quot;GitHub Actions&quot;)</li>
            <li>Copy the key (it starts with <code className="px-1.5 py-0.5 rounded bg-muted text-xs">exolar_</code>)</li>
          </ol>
          <div className="p-4 rounded-lg glass-panel">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Key className="h-4 w-4" />
              <span className="text-sm font-medium">Important</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Save your API key securely. It will only be shown once.
              If you lose it, you&apos;ll need to create a new one.
            </p>
          </div>
        </div>
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
            2
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Install the Reporter</h2>
        </div>
        <div className="pl-11 space-y-4">
          <p className="text-muted-foreground">
            Add the Exolar QA Playwright reporter to your project:
          </p>
          <pre className="p-4 rounded-lg glass-panel text-sm overflow-x-auto">
            <code>npm install -D @exolar-qa/playwright-reporter</code>
          </pre>
          <p className="text-sm text-muted-foreground">
            Or with yarn/pnpm:
          </p>
          <pre className="p-4 rounded-lg glass-panel text-xs sm:text-sm overflow-x-auto">
            <code>{`yarn add -D @exolar-qa/playwright-reporter
# or
pnpm add -D @exolar-qa/playwright-reporter`}</code>
          </pre>
        </div>
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
            3
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Configure Playwright</h2>
        </div>
        <div className="pl-11 space-y-4">
          <p className="text-muted-foreground">
            Add the reporter to your <code className="px-1.5 py-0.5 rounded bg-muted text-xs">playwright.config.ts</code>:
          </p>
          <pre className="p-4 rounded-lg glass-panel text-xs sm:text-sm overflow-x-auto">
            <code>{`// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { exolar } from "@exolar-qa/playwright-reporter";

export default defineConfig({
  reporter: [
    ["html"],
    [exolar, {
      apiKey: process.env.EXOLAR_API_KEY,
    }]
  ],

  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});`}</code>
          </pre>
        </div>
      </section>

      {/* Step 4 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
            4
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Add GitHub Secret</h2>
        </div>
        <div className="pl-11 space-y-4">
          <p className="text-muted-foreground">
            Add your API key to GitHub repository secrets:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Go to your GitHub repository</li>
            <li>Click <strong className="text-foreground">Settings</strong> &rarr; <strong className="text-foreground">Secrets and variables</strong> &rarr; <strong className="text-foreground">Actions</strong></li>
            <li>Click <strong className="text-foreground">&quot;New repository secret&quot;</strong></li>
            <li>Name: <code className="px-1.5 py-0.5 rounded bg-muted text-xs">EXOLAR_API_KEY</code></li>
            <li>Value: Paste your API key from Step 1</li>
          </ol>
        </div>
      </section>

      {/* Step 5 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
            5
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Update GitHub Actions</h2>
        </div>
        <div className="pl-11 space-y-4">
          <p className="text-muted-foreground">
            Pass the API key to your test workflow:
          </p>
          <pre className="p-4 rounded-lg glass-panel text-xs sm:text-sm overflow-x-auto">
            <code>{`# .github/workflows/playwright.yml
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
          EXOLAR_API_KEY: \${{ secrets.EXOLAR_API_KEY }}`}</code>
          </pre>
        </div>
      </section>

      {/* Step 6 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold text-sm">
            <CheckCircle className="h-5 w-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold">Done! Run Your Tests</h2>
        </div>
        <div className="pl-11 space-y-4">
          <p className="text-muted-foreground">
            Push a commit to trigger your workflow. After the tests run,
            you&apos;ll see results appear in your Exolar QA dashboard within seconds.
          </p>
          <div className="p-4 rounded-lg glass-panel">
            <h3 className="font-medium mb-2">Verify it&apos;s working</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Check your GitHub Actions logs for these messages:
            </p>
            <pre className="p-3 rounded bg-muted/50 text-xs overflow-x-auto">
              <code>{`[Exolar] Initialized - will send results to dashboard
[Exolar] Sending 15 results to dashboard...
[Exolar] Results sent successfully - execution_id: 123`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-xl font-semibold">Next Steps</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/docs/reporter/npm"
            className="group p-4 rounded-xl glass-card hover:glass-card-glow transition-all"
          >
            <Package className="h-6 w-6 mb-2 text-primary" />
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              Reporter Configuration
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Explore all available options
            </p>
          </Link>
          <Link
            href="/docs/mcp"
            className="group p-4 rounded-xl glass-card hover:glass-card-glow transition-all"
          >
            <Eye className="h-6 w-6 mb-2 text-primary" />
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              Connect Claude Code
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Let AI help debug failures
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
