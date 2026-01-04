import Link from "next/link"
import { AlertCircle, CheckCircle, HelpCircle, ArrowRight } from "lucide-react"

export const metadata = {
  title: "Troubleshooting - Exolar QA",
  description: "Common issues and solutions for Exolar integration",
}

const issues = [
  {
    id: "no-results",
    title: "No results appearing in dashboard",
    symptoms: [
      "Tests run successfully but nothing shows in Exolar",
      "No errors in CI logs",
      "Dashboard shows empty or stale data",
    ],
    causes: [
      "API key not set or incorrect",
      "Reporter not enabled in CI",
      "Wrong organization",
    ],
    solutions: [
      {
        step: "Verify API key is set",
        detail: "Check that EXOLAR_API_KEY is properly set in your GitHub Secrets and passed to the test job.",
        code: `# In your workflow
env:
  EXOLAR_API_KEY: \${{ secrets.EXOLAR_API_KEY }}`,
      },
      {
        step: "Check CI logs for initialization",
        detail: "Look for the Exolar reporter initialization message in your CI output.",
        code: `[Exolar] Initialized - will send results to dashboard`,
      },
      {
        step: "Verify API key is valid",
        detail: "Make sure your API key starts with 'exolar_' and hasn't been revoked.",
      },
      {
        step: "Check organization",
        detail: "Results are scoped to the organization that owns the API key. Make sure you're viewing the correct organization in the dashboard.",
      },
    ],
  },
  {
    id: "auth-failed",
    title: "Authentication failed / 401 error",
    symptoms: [
      "CI logs show 'Unauthorized' or '401' error",
      "Results not being uploaded",
    ],
    causes: [
      "Invalid or revoked API key",
      "Missing API key",
      "Expired API key",
    ],
    solutions: [
      {
        step: "Create a new API key",
        detail: "Go to Settings > API Keys and create a fresh key.",
      },
      {
        step: "Update GitHub Secret",
        detail: "Replace the old secret with the new API key in your repository settings.",
      },
      {
        step: "Check for typos",
        detail: "Ensure the secret name matches exactly: EXOLAR_API_KEY",
      },
    ],
  },
  {
    id: "artifacts-missing",
    title: "Screenshots/videos not uploading",
    symptoms: [
      "Test results appear but no artifacts",
      "Artifact links missing or broken",
      "Logs show 'Skipping artifact'",
    ],
    causes: [
      "Playwright not configured to capture artifacts",
      "Artifacts exceed size limit",
      "includeArtifacts set to false",
    ],
    solutions: [
      {
        step: "Configure Playwright to capture artifacts",
        detail: "Add artifact capture settings to your playwright.config.ts:",
        code: `use: {
  screenshot: "only-on-failure",
  video: "retain-on-failure",
  trace: "retain-on-failure",
}`,
      },
      {
        step: "Check artifact sizes",
        detail: "Default limit is 5MB. Increase if needed:",
        code: `[exolar, {
  apiKey: process.env.EXOLAR_API_KEY,
  maxArtifactSize: 10 * 1024 * 1024, // 10MB
}]`,
      },
      {
        step: "Verify includeArtifacts is true",
        detail: "Make sure you haven't disabled artifact uploads:",
        code: `[exolar, {
  apiKey: process.env.EXOLAR_API_KEY,
  includeArtifacts: true, // default
}]`,
      },
    ],
  },
  {
    id: "reporter-disabled",
    title: "Reporter disabled / not running in CI",
    symptoms: [
      "No Exolar messages in CI logs",
      "Reporter works locally but not in CI",
    ],
    causes: [
      "CI environment not detected",
      "disabled option set to true",
      "Configuration error",
    ],
    solutions: [
      {
        step: "Verify CI environment variables",
        detail: "The reporter checks for CI=true or GITHUB_ACTIONS=true. Make sure these are set.",
        code: `# Should be automatic in GitHub Actions, but you can force it:
env:
  CI: true`,
      },
      {
        step: "Check for disabled flag",
        detail: "Ensure disabled is not set to true:",
        code: `[exolar, {
  apiKey: process.env.EXOLAR_API_KEY,
  disabled: false, // or remove this line
}]`,
      },
      {
        step: "Test CI detection locally",
        detail: "Run with CI=true to test:",
        code: `CI=true npx playwright test`,
      },
    ],
  },
  {
    id: "local-json",
    title: "Where are local AI context files?",
    symptoms: [
      "Want to use AI-enriched failure context locally",
      "Looking for JSON files for debugging",
    ],
    causes: [],
    solutions: [
      {
        step: "Find the files",
        detail: "When tests fail, the reporter creates JSON files in:",
        code: `test-results/ai-failures/`,
      },
      {
        step: "Use with AI assistants",
        detail: "These files contain structured error context that AI coding assistants can use for intelligent debugging. Point your AI assistant to these files when asking about test failures.",
      },
    ],
  },
  {
    id: "wrong-branch",
    title: "Results showing wrong branch name",
    symptoms: [
      "Branch shows as 'merge' or PR number",
      "Expected branch name not appearing",
    ],
    causes: [
      "PR merge ref being used instead of source branch",
    ],
    solutions: [
      {
        step: "This is handled automatically",
        detail: "The reporter prefers GITHUB_HEAD_REF (the actual source branch for PRs) over GITHUB_REF_NAME. If you're still seeing issues, check your workflow is running on the PR event.",
      },
      {
        step: "For push events",
        detail: "GITHUB_REF_NAME is used, which should be the correct branch name.",
      },
    ],
  },
]

export default function TroubleshootingPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Troubleshooting</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Common issues and solutions for Exolar integration. Can&apos;t find your issue?{" "}
          <Link href="https://github.com/Montinou/e2e-test-dashboard/issues" className="text-primary hover:underline">
            Open an issue on GitHub
          </Link>.
        </p>
      </div>

      {/* Quick Check */}
      <section className="p-4 sm:p-6 rounded-xl glass-card glass-card-amber">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold mb-2">Quick Diagnostic</h2>
            <p className="text-sm text-muted-foreground mb-3">
              First, check your CI logs for these messages:
            </p>
            <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto">
              <code>{`# ✅ Good - Reporter initialized
[Exolar] Initialized - will send results to dashboard
[Exolar] Sending 15 results to dashboard...
[Exolar] Results sent successfully - execution_id: 123

# ❌ Bad - API key missing
[Exolar] EXOLAR_API_KEY not set, reporter disabled

# ❌ Bad - Auth failed
[Exolar] Failed to send results: 401 Unauthorized`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Issues */}
      <section className="space-y-8">
        {issues.map((issue) => (
          <div
            key={issue.id}
            id={issue.id}
            className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow scroll-mt-20"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary shrink-0" />
              {issue.title}
            </h2>

            {issue.symptoms.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Symptoms</h3>
                <ul className="space-y-1">
                  {issue.symptoms.map((symptom, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground/50">&bull;</span>
                      {symptom}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Solutions</h3>
              {issue.solutions.map((solution, i) => (
                <div key={i} className="pl-4 border-l-2 border-primary/30">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-medium text-sm">{solution.step}</span>
                  </div>
                  {solution.detail && (
                    <p className="text-sm text-muted-foreground mb-2">{solution.detail}</p>
                  )}
                  {solution.code && (
                    <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto">
                      <code>{solution.code}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Still Need Help */}
      <section className="p-4 sm:p-6 rounded-xl glass-card">
        <h2 className="font-semibold mb-2">Still need help?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          If you can&apos;t find a solution here, please:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Check your CI logs for any error messages</li>
          <li>Verify your API key is correctly set</li>
          <li>
            <Link href="https://github.com/Montinou/e2e-test-dashboard/issues" className="text-primary hover:underline">
              Open an issue on GitHub
            </Link>{" "}
            with:
            <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground/75">
              <li>Your reporter configuration (without the API key)</li>
              <li>Relevant CI logs</li>
              <li>Playwright version</li>
            </ul>
          </li>
        </ol>
      </section>

      {/* Next Steps */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-xl font-semibold">Related Documentation</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/docs/reporter/npm"
            className="group p-4 rounded-xl glass-card hover:glass-card-glow transition-all"
          >
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              Reporter Configuration
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              All available options
            </p>
          </Link>
          <Link
            href="/docs/api"
            className="group p-4 rounded-xl glass-card hover:glass-card-glow transition-all"
          >
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              API Reference
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Direct API access
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
