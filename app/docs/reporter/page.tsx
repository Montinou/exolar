import Link from "next/link"
import { Package, ArrowRight } from "lucide-react"
import { CodeBlock } from "@/components/docs/code-block"

export const metadata = {
  title: "Playwright Reporter - Exolar QA",
  description: "Integrate Playwright tests with Exolar QA dashboard",
}

const integrationOptions = [
  {
    title: "npm Package",
    description: "Install our official Playwright reporter for the best experience. Includes all configuration options.",
    href: "/docs/reporter/npm",
    icon: Package,
    recommended: true,
  },
]

export default function ReporterPage() {
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
        >Playwright Reporter</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          The Exolar QA reporter automatically captures your Playwright test results
          and sends them to your dashboard. Choose how you want to integrate.
        </p>
      </div>

      {/* How it Works */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">How It Works</h2>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <ol className="space-y-3 text-muted-foreground">
            <li>
              <strong className="text-foreground">Test Execution</strong> &ndash;
              Playwright runs your tests as normal
            </li>
            <li>
              <strong className="text-foreground">Data Capture</strong> &ndash;
              The reporter captures results, logs, and artifacts
            </li>
            <li>
              <strong className="text-foreground">Upload</strong> &ndash;
              Results are sent to Exolar QA API (only in CI)
            </li>
            <li>
              <strong className="text-foreground">Dashboard</strong> &ndash;
              View results instantly in your dashboard
            </li>
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Features</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">CI-Only Activation</h3>
            <p className="text-sm text-muted-foreground">
              Automatically detects CI environments. No uploads during local development.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Zero Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Works out of the box with just an API key. All settings have sensible defaults.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">AI-Enriched Context</h3>
            <p className="text-sm text-muted-foreground">
              Captures detailed failure context for intelligent debugging with AI assistants.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Artifact Upload</h3>
            <p className="text-sm text-muted-foreground">
              Screenshots, videos, and traces are uploaded and accessible from the dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Integration Options */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Integration Options</h2>
        <div className="grid gap-4">
          {integrationOptions.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className={`group p-4 sm:p-6 rounded-xl glass-card hover:glass-card-glow transition-all ${
                option.recommended ? "border-2 border-primary/50" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <option.icon className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {option.title}
                    </h3>
                    {option.recommended && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-exolar-cyan/10 text-exolar-cyan border border-exolar-cyan/30">
                        Recommended
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Example */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Quick Example</h2>
        <CodeBlock
          title="playwright.config.ts"
          code={`// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { exolar } from "@exolar-qa/playwright-reporter";

export default defineConfig({
  reporter: [
    ["html"],
    [exolar, { apiKey: process.env.EXOLAR_API_KEY }]
  ],
});`}
        />
        <p className="text-sm text-muted-foreground">
          That&apos;s it! The reporter will automatically send results to Exolar QA when running in CI.
        </p>
      </section>

      {/* V2 Features */}
      <section className="space-y-6">
        <h2 className="text-xl sm:text-2xl font-semibold">V2 Features &mdash; Ticket Linking &amp; Enhanced Context</h2>

        {/* Ticket Linking */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Ticket Linking</h3>
          <p className="text-sm text-muted-foreground">
            Link test files or tagged specs to Linear tickets using explicit mappings or automatic branch-name detection.
            Two approaches are supported and can be combined.
          </p>
          <CodeBlock
            title="playwright.config.ts"
            code={`// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { exolar } from "@exolar-qa/playwright-reporter";

export default defineConfig({
  reporter: [
    [exolar, {
      apiKey: process.env.EXOLAR_API_KEY,
      ticketMapping: {
        "tests/auth/login.spec.ts": "ENG-123",
        "@checkout": "ENG-456",
      },
      autoDetectTicket: true,  // detects ENG-123 from branch name
    }]
  ],
});`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl glass-card">
              <h4 className="font-medium mb-2">Explicit Mapping</h4>
              <p className="text-sm text-muted-foreground">
                Map individual spec files or test tags (prefixed with <code className="text-xs bg-muted px-1 py-0.5 rounded">@</code>) directly to ticket IDs in <code className="text-xs bg-muted px-1 py-0.5 rounded">ticketMapping</code>.
              </p>
            </div>
            <div className="p-4 rounded-xl glass-card">
              <h4 className="font-medium mb-2">Auto-Detection</h4>
              <p className="text-sm text-muted-foreground">
                Set <code className="text-xs bg-muted px-1 py-0.5 rounded">autoDetectTicket: true</code> to extract a ticket ID from the current git branch name (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">feat/ENG-123-login</code>).
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Failure Context */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Enhanced Failure Context (AIFailureContextV2)</h3>
          <p className="text-sm text-muted-foreground">
            Failed tests now capture richer context in the <code className="text-xs bg-muted px-1 py-0.5 rounded">AIFailureContextV2</code> payload, giving AI assistants and your team more signal when diagnosing failures.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl glass-card">
              <h4 className="font-medium mb-2">retry_history</h4>
              <p className="text-sm text-muted-foreground">
                Full history of every retry attempt: attempt number, pass/fail status, and duration in milliseconds. Identifies flaky tests that fail intermittently across retries.
              </p>
            </div>
            <div className="p-4 rounded-xl glass-card">
              <h4 className="font-medium mb-2">linked_ticket</h4>
              <p className="text-sm text-muted-foreground">
                The Linear ticket ID associated with the failing test, populated from either the explicit <code className="text-xs bg-muted px-1 py-0.5 rounded">ticketMapping</code> or branch-name auto-detection.
              </p>
            </div>
            <div className="p-4 rounded-xl glass-card">
              <h4 className="font-medium mb-2">dom_snapshot <span className="text-xs font-normal text-muted-foreground/60">(coming soon)</span></h4>
              <p className="text-sm text-muted-foreground">
                Accessibility tree captured at the exact point of failure, providing a lightweight structural snapshot of the page without a full screenshot.
              </p>
            </div>
            <div className="p-4 rounded-xl glass-card">
              <h4 className="font-medium mb-2">network_log <span className="text-xs font-normal text-muted-foreground/60">(coming soon)</span></h4>
              <p className="text-sm text-muted-foreground">
                Recent network requests made during the test, including URLs, methods, and status codes, to surface unexpected API errors or missing responses.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
