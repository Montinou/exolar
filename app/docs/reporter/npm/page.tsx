import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CodeBlock } from "@/components/docs/code-block"

export const metadata = {
  title: "npm Package - Exolar QA Playwright Reporter",
  description: "Install and configure the @exolar-qa/playwright-reporter npm package",
}

const basicUsageCode = `// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { exolar } from "@exolar-qa/playwright-reporter";

export default defineConfig({
  reporter: [
    // Keep your existing reporters
    ["html"],

    // Add Exolar QA reporter
    [exolar, {
      apiKey: process.env.EXOLAR_API_KEY,
    }]
  ],

  // Recommended: capture artifacts for failures
  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});`

const advancedConfigCode = `[exolar, {
  // Required
  apiKey: process.env.EXOLAR_API_KEY,

  // Self-hosted dashboard
  endpoint: "https://your-dashboard.example.com",

  // Only send on failure (saves bandwidth)
  onlyOnFailure: true,

  // Skip artifact uploads (faster)
  includeArtifacts: false,

  // Allow larger artifacts (10MB)
  maxArtifactSize: 10 * 1024 * 1024,

  // Disable completely (for debugging)
  disabled: process.env.DISABLE_EXOLAR === "true",
}]`

const typescriptCode = `import type { ExolarReporterOptions } from "@exolar-qa/playwright-reporter";

const options: ExolarReporterOptions = {
  apiKey: process.env.EXOLAR_API_KEY,
  onlyOnFailure: true,
};`

export default function ReporterNpmPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/docs/reporter" className="hover:text-foreground transition-colors">
            Reporter
          </Link>
          <span>/</span>
          <span className="text-foreground">npm Package</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">@exolar-qa/playwright-reporter</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          The official Playwright reporter for Exolar QA. Automatically uploads test results to your dashboard.
        </p>
      </div>

      {/* Installation */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Installation</h2>
        <CodeBlock code="npm install -D @exolar-qa/playwright-reporter" />
        <p className="text-sm text-muted-foreground">
          Or with other package managers:
        </p>
        <CodeBlock code={`yarn add -D @exolar-qa/playwright-reporter
pnpm add -D @exolar-qa/playwright-reporter`} />
      </section>

      {/* Basic Usage */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Basic Usage</h2>
        <CodeBlock code={basicUsageCode} title="playwright.config.ts" />
      </section>

      {/* Configuration Options */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Configuration Options</h2>
        <div className="p-4 sm:p-6 rounded-xl glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 font-medium">Option</th>
                <th className="text-left py-3 pr-4 font-medium">Type</th>
                <th className="text-left py-3 pr-4 font-medium">Default</th>
                <th className="text-left py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">apiKey</code></td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">EXOLAR_API_KEY</code></td>
                <td className="py-3">API key for authentication</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">endpoint</code></td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://exolar.qa</code></td>
                <td className="py-3">Dashboard URL (for self-hosted)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">onlyOnFailure</code></td>
                <td className="py-3 pr-4">boolean</td>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">false</code></td>
                <td className="py-3">Only upload when tests fail</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">includeArtifacts</code></td>
                <td className="py-3 pr-4">boolean</td>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">true</code></td>
                <td className="py-3">Include screenshots, videos, traces</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">maxArtifactSize</code></td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">5MB</code></td>
                <td className="py-3">Max artifact size in bytes</td>
              </tr>
              <tr>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">disabled</code></td>
                <td className="py-3 pr-4">boolean</td>
                <td className="py-3 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">false</code></td>
                <td className="py-3">Disable the reporter entirely</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Advanced Configuration */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Advanced Configuration</h2>
        <CodeBlock code={advancedConfigCode} />
      </section>

      {/* Environment Variables */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Environment Variables</h2>
        <div className="grid gap-4">
          <div className="p-4 sm:p-6 rounded-xl glass-card">
            <h3 className="font-medium mb-3">Required</h3>
            <table className="w-full text-sm">
              <tbody className="text-muted-foreground">
                <tr>
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">EXOLAR_API_KEY</code></td>
                  <td className="py-2">Your Exolar QA API key</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 sm:p-6 rounded-xl glass-card">
            <h3 className="font-medium mb-3">Optional</h3>
            <table className="w-full text-sm">
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">EXOLAR_URL</code></td>
                  <td className="py-2">Dashboard URL (for self-hosted)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">TEST_SUITE_NAME</code></td>
                  <td className="py-2">Name for the test suite (e.g., "E2E", "Smoke")</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 sm:p-6 rounded-xl glass-card">
            <h3 className="font-medium mb-3">Auto-detected from GitHub Actions</h3>
            <table className="w-full text-sm">
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GITHUB_RUN_ID</code></td>
                  <td className="py-2">Unique workflow run ID</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GITHUB_HEAD_REF</code></td>
                  <td className="py-2">Branch name (for PRs)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GITHUB_SHA</code></td>
                  <td className="py-2">Commit SHA</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GITHUB_ACTOR</code></td>
                  <td className="py-2">User who triggered the workflow</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">GITHUB_WORKFLOW</code></td>
                  <td className="py-2">Workflow name</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TypeScript */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">TypeScript Support</h2>
        <p className="text-muted-foreground">
          The package includes full TypeScript definitions. Import types as needed:
        </p>
        <CodeBlock code={typescriptCode} />
      </section>

      {/* Next Steps */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-xl font-semibold">Next Steps</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/docs/troubleshooting"
            className="group p-4 rounded-xl glass-card transition-all"
          >
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              Troubleshooting
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Common issues and solutions
            </p>
          </Link>
          <Link
            href="/docs/api"
            className="group p-4 rounded-xl glass-card transition-all"
          >
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              API Reference
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Direct API access for custom integrations
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
