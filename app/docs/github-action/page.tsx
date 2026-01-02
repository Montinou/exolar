"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import Link from "next/link"

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      {title && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border rounded-t-lg text-xs text-muted-foreground font-mono">
          {title}
        </div>
      )}
      <pre className={`p-4 bg-muted text-sm overflow-x-auto ${title ? "rounded-b-lg" : "rounded-lg"}`}>
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

const basicExample = `name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npx playwright test

      - name: Upload to Aestra
        if: always()
        uses: Montinou/e2e-test-dashboard-action@v1
        with:
          api-key: \${{ secrets.AESTRA_API_KEY }}
          results-path: ./test-results`

const fullExample = `- name: Upload to Aestra
  if: always()
  uses: Montinou/e2e-test-dashboard-action@v1
  with:
    # Required
    api-key: \${{ secrets.AESTRA_API_KEY }}

    # Optional - customize paths
    results-path: ./test-results
    report-path: ./playwright-report

    # Optional - metadata
    suite-name: "E2E Tests"
    branch: \${{ github.ref_name }}
    commit-sha: \${{ github.sha }}

    # Optional - artifact upload
    upload-artifacts: true
    artifact-types: "video,screenshot,trace"`

export default function GitHubActionDocsPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">GitHub Action</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Automatically upload your Playwright test results to Aestra
          from GitHub Actions. Track test history, detect flaky tests, and analyze failures.
        </p>
      </div>

      {/* Quick Start */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Quick Start</h2>

        <div className="space-y-4">
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
              Get your API Key
            </h3>
            <p className="text-sm text-muted-foreground">
              Go to <Link href="/settings/api-keys" className="text-primary hover:underline">Settings &rarr; API Keys</Link> in the dashboard and create a new API key.
              Copy the key (it starts with <code className="px-1 py-0.5 rounded bg-muted">aestra_</code>) - you&apos;ll need it for the next step.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
              Add the secret to GitHub
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              In your GitHub repository, go to <strong>Settings &rarr; Secrets and variables &rarr; Actions</strong>.
              Create a new secret named <code className="px-1 py-0.5 rounded bg-muted">AESTRA_API_KEY</code> with your API key.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">3</span>
              Add to your workflow
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add the action to your Playwright workflow file:
            </p>
            <CodeBlock code={basicExample} title=".github/workflows/playwright.yml" />
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Configuration</h2>

        <h3 className="font-semibold text-lg">All Options</h3>
        <CodeBlock code={fullExample} />

        <h3 className="font-semibold text-lg mt-8">Input Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Input</th>
                <th className="text-left py-3 px-4 font-semibold">Required</th>
                <th className="text-left py-3 px-4 font-semibold">Default</th>
                <th className="text-left py-3 px-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3 px-4"><code className="text-primary">api-key</code></td>
                <td className="py-3 px-4">Yes</td>
                <td className="py-3 px-4">-</td>
                <td className="py-3 px-4 text-muted-foreground">API key from the dashboard</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code className="text-primary">results-path</code></td>
                <td className="py-3 px-4">No</td>
                <td className="py-3 px-4">./test-results</td>
                <td className="py-3 px-4 text-muted-foreground">Path to Playwright test results</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code className="text-primary">report-path</code></td>
                <td className="py-3 px-4">No</td>
                <td className="py-3 px-4">./playwright-report</td>
                <td className="py-3 px-4 text-muted-foreground">Path to Playwright HTML report</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code className="text-primary">suite-name</code></td>
                <td className="py-3 px-4">No</td>
                <td className="py-3 px-4">default</td>
                <td className="py-3 px-4 text-muted-foreground">Name for grouping test runs</td>
              </tr>
              <tr>
                <td className="py-3 px-4"><code className="text-primary">upload-artifacts</code></td>
                <td className="py-3 px-4">No</td>
                <td className="py-3 px-4">true</td>
                <td className="py-3 px-4 text-muted-foreground">Upload videos, screenshots, traces</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Playwright Config */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Playwright Configuration</h2>
        <p className="text-muted-foreground">
          Make sure your Playwright config outputs test results in JSON format:
        </p>
        <CodeBlock
          code={`// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    // Capture screenshots and videos on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});`}
          title="playwright.config.ts"
        />
      </section>

      {/* Troubleshooting */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Troubleshooting</h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">No test results uploaded</h3>
            <p className="text-sm text-muted-foreground">
              Make sure your Playwright config includes the JSON reporter and the <code className="px-1 py-0.5 rounded bg-muted">results-path</code> matches your output directory.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">Authentication failed</h3>
            <p className="text-sm text-muted-foreground">
              Verify your API key is correct and the secret is properly configured in GitHub.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">Action not running on failure</h3>
            <p className="text-sm text-muted-foreground">
              Add <code className="px-1 py-0.5 rounded bg-muted">if: always()</code> to ensure the action runs even when tests fail.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
