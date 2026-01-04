"use client"

import Link from "next/link"
import { CodeBlock } from "@/components/docs/code-block"
import { TableOfContents, TOCItem } from "@/components/docs/table-of-contents"

const tocItems: TOCItem[] = [
  { id: "quick-start", text: "Quick Start" },
  { id: "configuration", text: "Configuration" },
  { id: "playwright-config", text: "Playwright Configuration" },
  { id: "troubleshooting", text: "Troubleshooting" },
]

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

      - name: Upload to Exolar
        if: always()
        uses: Montinou/e2e-test-dashboard-action@v1
        with:
          api-key: \${{ secrets.EXOLAR_API_KEY }}
          results-path: ./test-results`

const fullExample = `- name: Upload to Exolar
  if: always()
  uses: Montinou/e2e-test-dashboard-action@v1
  with:
    # Required
    api-key: \${{ secrets.EXOLAR_API_KEY }}

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

const inputReference = [
  { name: "api-key", required: "Yes", default: "-", desc: "API key from the dashboard" },
  { name: "results-path", required: "No", default: "./test-results", desc: "Path to Playwright test results" },
  { name: "report-path", required: "No", default: "./playwright-report", desc: "Path to Playwright HTML report" },
  { name: "suite-name", required: "No", default: "default", desc: "Name for grouping test runs" },
  { name: "upload-artifacts", required: "No", default: "true", desc: "Upload videos, screenshots, traces" },
]

function InputTable() {
  return (
    <div>
      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-3">
        {inputReference.map((input) => (
          <div key={input.name} className="p-3 rounded-lg glass-panel">
            <div className="flex items-center gap-2 mb-2">
              <code className="text-primary text-sm">{input.name}</code>
              {input.required === "Yes" && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Required</span>
              )}
            </div>
            {input.default !== "-" && (
              <p className="text-xs text-muted-foreground mb-1">
                Default: <code className="px-1 py-0.5 rounded bg-muted">{input.default}</code>
              </p>
            )}
            <p className="text-sm text-muted-foreground">{input.desc}</p>
          </div>
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block overflow-x-auto">
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
            {inputReference.map((input) => (
              <tr key={input.name}>
                <td className="py-3 px-4"><code className="text-primary">{input.name}</code></td>
                <td className="py-3 px-4">{input.required}</td>
                <td className="py-3 px-4">{input.default}</td>
                <td className="py-3 px-4 text-muted-foreground">{input.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function GitHubActionDocsPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Mobile TOC */}
      <TableOfContents items={tocItems} />

      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">GitHub Action</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Automatically upload your Playwright test results to Exolar
          from GitHub Actions. Track test history, detect flaky tests, and analyze failures.
        </p>
      </div>

      {/* Quick Start */}
      <section id="quick-start" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Quick Start</h2>

        <div className="space-y-4">
          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">1</span>
              Get your API Key
            </h3>
            <p className="text-sm text-muted-foreground">
              Go to <Link href="/settings/api-keys" className="text-primary hover:underline">Settings &rarr; API Keys</Link> in the dashboard and create a new API key.
              Copy the key (it starts with <code className="px-1 py-0.5 rounded glass-panel">exolar_</code>) - you&apos;ll need it for the next step.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">2</span>
              Add the secret to GitHub
            </h3>
            <p className="text-sm text-muted-foreground">
              In your GitHub repository, go to <strong>Settings &rarr; Secrets and variables &rarr; Actions</strong>.
              Create a new secret named <code className="px-1 py-0.5 rounded glass-panel">EXOLAR_API_KEY</code> with your API key.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">3</span>
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
      <section id="configuration" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Configuration</h2>

        <h3 className="font-semibold text-base sm:text-lg">All Options</h3>
        <CodeBlock code={fullExample} />

        <h3 className="font-semibold text-base sm:text-lg mt-6 sm:mt-8">Input Reference</h3>
        <InputTable />
      </section>

      {/* Playwright Config */}
      <section id="playwright-config" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Playwright Configuration</h2>
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
      <section id="troubleshooting" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Troubleshooting</h2>
        <div className="space-y-3 sm:space-y-4">
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">No test results uploaded</h3>
            <p className="text-sm text-muted-foreground">
              Make sure your Playwright config includes the JSON reporter and the <code className="px-1 py-0.5 rounded glass-panel">results-path</code> matches your output directory.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">Authentication failed</h3>
            <p className="text-sm text-muted-foreground">
              Verify your API key is correct and the secret is properly configured in GitHub.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-2">Action not running on failure</h3>
            <p className="text-sm text-muted-foreground">
              Add <code className="px-1 py-0.5 rounded glass-panel">if: always()</code> to ensure the action runs even when tests fail.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
