"use client"

import Link from "next/link"
import { CodeBlock } from "@/components/docs/code-block"
import { GitBranch, Zap, ShieldCheck, Bug, Bell, Settings } from "lucide-react"

const webhookExample = `// Settings > Webhooks > New Webhook
{
  "url": "https://your-server.com/hooks/exolar",
  "secret": "your-hmac-secret",
  "events": ["ci.run.failed", "ci.run.fixed"]
}`

const hmacExample = `import crypto from "crypto"

function verifyWebhook(payload: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
  return \`sha256=\${expected}\` === signature
}

// In your handler:
const sig = req.headers["x-exolar-signature"]
if (!verifyWebhook(rawBody, sig, process.env.WEBHOOK_SECRET)) {
  return res.status(401).end()
}`

const analyzeApiExample = `POST /api/ci/analyze
Authorization: Bearer exolar_...
Content-Type: application/json

{
  "execution_id": "exec_abc123",   // optional — reporter execution ID
  "run_id": "run_gh_456"           // optional — GitHub Actions run ID
}

// Response
{
  "analysis_id": "anl_789",
  "classification": "HEALABLE",
  "confidence": 0.92,
  "action_plan": {
    "action": "open_pr",
    "title": "fix: update selector in checkout spec",
    "files": ["tests/checkout.spec.ts"],
    "patch": "...",
    "ticket": "ENG-1042"
  },
  "summary": "CSS selector outdated after design system update."
}`

const reporterTicketConfig = `// playwright.config.ts
import { exolar } from "@exolar-qa/playwright-reporter"

export default defineConfig({
  reporter: [
    ["html"],
    [exolar, {
      apiKey: process.env.EXOLAR_API_KEY,
      ticketMapping: {
        // Auto-detect ticket from branch name
        autoDetectTicket: true,
        pattern: /([A-Z]+-\d+)/,          // e.g. ENG-1042
        source: "branch",                  // "branch" | "commit" | "pr-title"
      },
      autoHeal: {
        enabled: true,
        confidenceThreshold: 0.85,
      },
    }]
  ],
})`

const sentinelExample = `# Option A — OpenClaw sentinel agent (argus)
# In ~/.openclaw-nix/hosts/montino.nix, argus is already configured.
# Add the ci-analysis webhook URL to its trigger list.

# Option B — GitHub Actions (Claude Code Action)
- name: Trigger Exolar CI Analysis
  if: failure()
  uses: anthropics/claude-code-action@v1
  with:
    prompt: |
      Analyze the failed CI run via Exolar.
      POST https://app.exolar.dev/api/ci/analyze
      with run_id: \${{ github.run_id }}
    anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}`

export default function CIAnalysisPage() {
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
        >CI Auto-Analysis</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          When CI runs fail, Exolar classifies the failure and takes the right action automatically —
          opening a fix PR, filing a bug, annotating a flake, or alerting on infrastructure issues.
        </p>
      </div>

      {/* Overview */}
      <section id="overview" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 rounded-xl glass-card">
            <Zap className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-medium mb-1">Automated Triage</h3>
            <p className="text-sm text-muted-foreground">
              Every failure is classified into one of four categories so the right action fires without human intervention.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <GitBranch className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-medium mb-1">Ticket-Aware</h3>
            <p className="text-sm text-muted-foreground">
              Links failures to Linear / GitHub Issues tickets via branch name, commit message, or PR title.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <ShieldCheck className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-medium mb-1">Safe by Default</h3>
            <p className="text-sm text-muted-foreground">
              Guardrails enforce confidence thresholds, file-scope limits, and per-repo rate caps before any code changes land.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <Settings className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-medium mb-1">Flexible Trigger</h3>
            <p className="text-sm text-muted-foreground">
              Trigger via webhook, the REST API, or a Claude Code Action step — whatever fits your CI setup.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">How It Works</h2>
        <p className="text-muted-foreground text-sm">
          The reporter uploads execution data after each run. On failure, the analysis engine classifies
          the root cause and dispatches the appropriate action.
        </p>
        <div className="p-4 sm:p-6 rounded-xl glass-card font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto">
          <pre>{`CI Run → Reporter → Exolar → Analysis Engine → Action
                                   ├─ HEALABLE     → Auto-fix PR
                                   ├─ REAL_BUG     → GitHub Issue
                                   ├─ KNOWN_FLAKE  → Dashboard annotation
                                   └─ INFRA        → Alert only`}</pre>
        </div>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <ol className="space-y-3 text-muted-foreground text-sm">
            <li><strong className="text-foreground">CI Run</strong> &ndash; Your test suite runs in GitHub Actions (or any CI)</li>
            <li><strong className="text-foreground">Reporter</strong> &ndash; The Exolar Playwright reporter uploads results, logs, and artifacts</li>
            <li><strong className="text-foreground">Analysis Engine</strong> &ndash; LLM-assisted classification with historical flake data and ticket context</li>
            <li><strong className="text-foreground">Action</strong> &ndash; The matched handler fires: PR, issue, annotation, or alert</li>
          </ol>
        </div>
      </section>

      {/* Setup */}
      <section id="setup" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Setup</h2>

        <div className="space-y-4">
          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">1</span>
              Install reporter with ticket-linking config
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add <code className="px-1 py-0.5 rounded glass-panel">autoDetectTicket</code> and <code className="px-1 py-0.5 rounded glass-panel">autoHeal</code> options
              to your reporter config. See <Link href="/docs/reporter/npm" className="text-primary hover:underline">Reporter docs</Link> for full options.
            </p>
            <CodeBlock code={reporterTicketConfig} title="playwright.config.ts" />
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">2</span>
              Configure webhook
            </h3>
            <p className="text-sm text-muted-foreground">
              Go to <Link href="/settings/webhooks" className="text-primary hover:underline">Settings &rarr; Webhooks</Link> and
              add your endpoint. Subscribe to <code className="px-1 py-0.5 rounded glass-panel">ci.run.failed</code> events.
              Exolar signs every request with HMAC-SHA256 — see the <a href="#webhooks" className="text-primary hover:underline">Webhooks</a> section below.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-2 flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm">3</span>
              Set up the analysis trigger
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose between an OpenClaw sentinel agent (recommended for Montino infrastructure) or a GitHub Actions step:
            </p>
            <CodeBlock code={sentinelExample} title="trigger options" />
          </div>
        </div>
      </section>

      {/* API Reference */}
      <section id="api" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">API Reference</h2>
        <p className="text-muted-foreground text-sm">
          Trigger analysis manually or from any CI step via the REST API.
          Authentication uses the same Bearer API key from <Link href="/settings/api-keys" className="text-primary hover:underline">Settings &rarr; API Keys</Link>.
        </p>
        <CodeBlock code={analyzeApiExample} title="POST /api/ci/analyze" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold">Field</th>
                <th className="text-left py-3 px-4 font-semibold">Type</th>
                <th className="text-left py-3 px-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { field: "execution_id", type: "string?", desc: "Reporter execution ID — preferred when available" },
                { field: "run_id", type: "string?", desc: "GitHub Actions run ID — fallback if no execution_id" },
                { field: "analysis_id", type: "string", desc: "Unique ID for this analysis result" },
                { field: "classification", type: "enum", desc: "HEALABLE | REAL_BUG | KNOWN_FLAKE | INFRA" },
                { field: "confidence", type: "number", desc: "0–1 score; actions only fire above configured threshold" },
                { field: "action_plan", type: "object", desc: "Action to take plus all data needed to execute it" },
              ].map(row => (
                <tr key={row.field}>
                  <td className="py-3 px-4"><code className="text-primary">{row.field}</code></td>
                  <td className="py-3 px-4 text-muted-foreground">{row.type}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sm:hidden space-y-3">
            {[
              { field: "execution_id", type: "string?", desc: "Reporter execution ID — preferred when available" },
              { field: "run_id", type: "string?", desc: "GitHub Actions run ID — fallback if no execution_id" },
              { field: "classification", type: "enum", desc: "HEALABLE | REAL_BUG | KNOWN_FLAKE | INFRA" },
              { field: "confidence", type: "number", desc: "0–1; actions only fire above configured threshold" },
            ].map(row => (
              <div key={row.field} className="p-3 rounded-lg glass-panel">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-primary text-sm">{row.field}</code>
                  <span className="text-xs text-muted-foreground">{row.type}</span>
                </div>
                <p className="text-sm text-muted-foreground">{row.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section id="webhooks" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Webhooks</h2>
        <p className="text-muted-foreground text-sm">
          Exolar sends a <code className="px-1 py-0.5 rounded glass-panel">POST</code> to your endpoint for each subscribed event.
          Every request includes an <code className="px-1 py-0.5 rounded glass-panel">x-exolar-signature</code> header for verification.
        </p>
        <div className="space-y-3">
          {[
            { event: "ci.run.failed", desc: "Fired when a CI run completes with at least one failed test" },
            { event: "ci.run.fixed", desc: "Fired when a previously failing run passes again" },
            { event: "ci.analysis.complete", desc: "Fired after the analysis engine produces a result" },
            { event: "ci.heal.pr_opened", desc: "Fired when an auto-heal PR is opened" },
          ].map(e => (
            <div key={e.event} className="p-3 sm:p-4 rounded-xl glass-card flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <code className="text-primary shrink-0">{e.event}</code>
              <span className="text-sm text-muted-foreground">{e.desc}</span>
            </div>
          ))}
        </div>
        <CodeBlock code={hmacExample} title="webhook verification" />
      </section>

      {/* Auto-Heal */}
      <section id="auto-heal" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Auto-Heal</h2>
        <p className="text-muted-foreground text-sm">
          When a failure is classified as <code className="px-1 py-0.5 rounded glass-panel">HEALABLE</code> with sufficient
          confidence, Exolar opens a draft PR with the suggested fix. Five fix strategies are supported:
        </p>
        <div className="space-y-3">
          {[
            {
              name: "Selector Update",
              desc: "Re-derives a stable CSS/ARIA selector when the DOM structure changed after a UI update.",
            },
            {
              name: "Assertion Tolerance",
              desc: "Widens numeric or timing assertions that became brittle due to environment variance.",
            },
            {
              name: "Wait Strategy",
              desc: "Replaces fixed sleeps or fragile waitForSelector calls with event-driven waits.",
            },
            {
              name: "Data Fixture Refresh",
              desc: "Updates hardcoded test data that no longer matches the application's current state.",
            },
            {
              name: "Import / Path Fix",
              desc: "Corrects broken imports or moved modules detected via static analysis of the error trace.",
            },
          ].map(s => (
            <div key={s.name} className="p-3 sm:p-4 rounded-xl glass-card glass-card-glow">
              <h3 className="font-semibold mb-1">{s.name}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bug Reports */}
      <section id="bug-reports" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Bug Reports</h2>
        <p className="text-muted-foreground text-sm">
          Failures classified as <code className="px-1 py-0.5 rounded glass-panel">REAL_BUG</code> automatically open a
          GitHub Issue with full context: stack trace, failing test, artifact links, and the linked ticket.
          Deduplication prevents duplicate issues for the same root cause.
        </p>
        <div className="space-y-3">
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-1">Deduplication</h3>
            <p className="text-sm text-muted-foreground">
              Before opening an issue, Exolar checks for existing open issues with a matching error signature.
              If a match is found, the new run is added as a comment instead.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-1">Issue Content</h3>
            <p className="text-sm text-muted-foreground">
              Auto-generated issues include: test name, error message, reproduction steps, CI run link,
              artifact URLs, and the linked ticket from your <code className="px-1 py-0.5 rounded glass-panel">ticketMapping</code> config.
            </p>
          </div>
        </div>
      </section>

      {/* Linear Integration */}
      <section id="linear" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Linear Integration</h2>
        <p className="text-muted-foreground text-sm">
          Connect a Linear workspace in <Link href="/settings/integrations" className="text-primary hover:underline">Settings &rarr; Integrations</Link> to
          enable ticket-aware analysis and acceptance criteria comparison.
        </p>
        <div className="space-y-3">
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-1">ticketMapping</h3>
            <p className="text-sm text-muted-foreground">
              Configured in the reporter. Exolar extracts the ticket ID from the branch name, commit message,
              or PR title using the regex <code className="px-1 py-0.5 rounded glass-panel">pattern</code> you provide.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-1">autoDetectTicket</h3>
            <p className="text-sm text-muted-foreground">
              When enabled, Exolar tries all three sources (<code className="px-1 py-0.5 rounded glass-panel">branch</code>,{" "}
              <code className="px-1 py-0.5 rounded glass-panel">commit</code>, <code className="px-1 py-0.5 rounded glass-panel">pr-title</code>) in order
              and uses the first match.
            </p>
          </div>
          <div className="p-3 sm:p-4 rounded-xl glass-card">
            <h3 className="font-semibold mb-1">AC Comparison</h3>
            <p className="text-sm text-muted-foreground">
              When a ticket is resolved, the analysis engine compares the test coverage against the
              acceptance criteria from Linear. Gaps are flagged as missing coverage, not bugs.
            </p>
          </div>
        </div>
      </section>

      {/* Guardrails */}
      <section id="guardrails" className="space-y-4 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-semibold">Guardrails</h2>
        <p className="text-muted-foreground text-sm">
          Auto-heal actions are gated by multiple safety checks before any PR is opened.
        </p>
        <div className="space-y-3">
          {[
            {
              name: "Confidence Threshold",
              desc: "Default 0.85. Auto-heal only fires when the analysis confidence meets or exceeds the configured threshold. Adjust in reporter config.",
            },
            {
              name: "File Scope Limit",
              desc: "A single auto-heal PR touches at most 3 files. Broader changes require human review and are flagged as REAL_BUG instead.",
            },
            {
              name: "Rate Limit",
              desc: "At most 5 auto-heal PRs per repo per day to prevent runaway automation during a bad deploy.",
            },
            {
              name: "Branch Protection Respected",
              desc: "Auto-heal PRs are always opened as drafts targeting a dedicated branch. They never push directly to main or protected branches.",
            },
            {
              name: "Human-in-the-Loop Override",
              desc: "Set autoHeal.enabled: false in the reporter config to disable auto-heal globally while still receiving classifications and alerts.",
            },
          ].map(g => (
            <div key={g.name} className="p-3 sm:p-4 rounded-xl glass-card glass-card-glow">
              <h3 className="font-semibold mb-1">{g.name}</h3>
              <p className="text-sm text-muted-foreground">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
