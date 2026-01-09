import Link from "next/link"
import { Terminal, Github, Code, ArrowRight, Rocket, Package, HelpCircle } from "lucide-react"

export const metadata = {
  title: "Documentation - Exolar QA",
  description: "Learn how to set up and use Exolar QA",
}

const quickLinks = [
  {
    title: "Quick Start",
    description: "Get up and running in 5 minutes with our step-by-step guide",
    href: "/docs/quickstart",
    icon: Rocket,
    highlight: true,
  },
  {
    title: "Playwright Reporter",
    description: "Install the npm package to automatically upload test results",
    href: "/docs/reporter",
    icon: Package,
  },
  {
    title: "MCP Integration",
    description: "Connect Claude Code to your test data with the MCP server",
    href: "/docs/mcp",
    icon: Terminal,
  },
  {
    title: "GitHub Action",
    description: "Automatically upload Playwright results from CI/CD",
    href: "/docs/github-action",
    icon: Github,
  },
  {
    title: "API Reference",
    description: "Direct API access for custom integrations",
    href: "/docs/api",
    icon: Code,
  },
  {
    title: "Troubleshooting",
    description: "Common issues and solutions for Exolar integration",
    href: "/docs/troubleshooting",
    icon: HelpCircle,
  },
]

export default function DocsPage() {
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
        >Documentation</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Learn how to set up Exolar, integrate with your CI/CD pipeline,
          and connect your AI coding assistant for intelligent test analysis.
        </p>
      </div>

      {/* Quick Start */}
      <section className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Get Started in 3 Steps</h2>
        <div className="grid gap-4">
          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-3 sm:mb-4">1. Install the Reporter</h3>
            <p className="text-sm text-muted-foreground mb-3 sm:mb-4">
              Add the Exolar Playwright reporter to your project:
            </p>
            <pre className="p-3 sm:p-4 rounded-md glass-panel text-xs sm:text-sm overflow-x-auto">
              <code>npm install -D @exolar-qa/playwright-reporter</code>
            </pre>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-3 sm:mb-4">2. Configure Playwright</h3>
            <p className="text-sm text-muted-foreground mb-3 sm:mb-4">
              <Link href="/settings/api-keys" className="text-primary hover:underline">Create an API key</Link>, then add the reporter to your config:
            </p>
            <pre className="p-3 sm:p-4 rounded-md glass-panel text-xs sm:text-sm overflow-x-auto">
              <code>{`// playwright.config.ts
import { exolar } from "@exolar-qa/playwright-reporter";

export default defineConfig({
  reporter: [["html"], [exolar, { apiKey: process.env.EXOLAR_API_KEY }]],
});`}</code>
            </pre>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
            <h3 className="font-semibold mb-3 sm:mb-4">3. Add to CI</h3>
            <p className="text-sm text-muted-foreground mb-3 sm:mb-4">
              Pass the API key as an environment variable in GitHub Actions:
            </p>
            <pre className="p-3 sm:p-4 rounded-md glass-panel text-xs sm:text-sm overflow-x-auto">
              <code>{`- run: npx playwright test
  env:
    EXOLAR_API_KEY: \${{ secrets.EXOLAR_API_KEY }}`}</code>
            </pre>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Need more details? Check out the{" "}
          <Link href="/docs/quickstart" className="text-primary hover:underline">full Quick Start guide</Link>.
        </p>
      </section>

      {/* Quick Links */}
      <section className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Explore</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group p-4 sm:p-6 rounded-xl glass-card hover:glass-card-glow transition-all"
            >
              <link.icon className="h-6 w-6 sm:h-8 sm:w-8 mb-3 sm:mb-4 text-primary" />
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors flex items-center gap-2">
                {link.title}
                {"highlight" in link && link.highlight && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    Start here
                  </span>
                )}
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all ml-auto" />
              </h3>
              <p className="text-sm text-muted-foreground">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Overview */}
      <section className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Features</h2>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <ul className="space-y-2 text-muted-foreground text-sm sm:text-base">
            <li><strong className="text-foreground">Reliability Score</strong> - Single 0-100 gauge showing test suite health at a glance</li>
            <li><strong className="text-foreground">Performance Regression Detection</strong> - Automatic alerts when tests become slower than baseline</li>
            <li><strong className="text-foreground">Real-time Dashboard</strong> - View test results, trends, and metrics</li>
            <li><strong className="text-foreground">Flaky Test Detection</strong> - Automatically identify and track flaky tests</li>
            <li><strong className="text-foreground">AI-Powered Analysis</strong> - Get intelligent insights about test failures</li>
            <li><strong className="text-foreground">MCP Integration</strong> - Direct access from Claude Code and other AI assistants</li>
            <li><strong className="text-foreground">Multi-tenant</strong> - Organization-level data isolation</li>
            <li><strong className="text-foreground">Artifact Storage</strong> - Videos, screenshots, and traces stored in R2</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
