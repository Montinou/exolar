import Link from "next/link"
import { Terminal, Github, Code, ArrowRight } from "lucide-react"

export const metadata = {
  title: "Documentation - Aestra",
  description: "Learn how to set up and use Aestra",
}

const quickLinks = [
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
]

export default function DocsPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Learn how to set up Aestra, integrate with your CI/CD pipeline,
          and connect your AI coding assistant for intelligent test analysis.
        </p>
      </div>

      {/* Quick Start */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Quick Start</h2>
        <div className="grid gap-4">
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-4">1. Set up the GitHub Action</h3>
            <p className="text-sm text-muted-foreground mb-4">
              First, <Link href="/settings/api-keys" className="text-primary hover:underline">create an API key</Link>, then add the GitHub Action to your repository:
            </p>
            <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
              <code>{`# .github/workflows/playwright.yml
- name: Upload to Aestra
  uses: Montinou/e2e-test-dashboard-action@v1
  with:
    api-key: \${{ secrets.AESTRA_API_KEY }}`}</code>
            </pre>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-4">2. Connect Claude Code (Optional)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Install the MCP server to give your AI coding assistant direct access to test results.
            </p>
            <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
              <code>{`# Authenticate
npx e2e-test-dashboard-mcp --login

# Add to Claude Code
claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Explore</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group p-6 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-colors"
            >
              <link.icon className="h-8 w-8 mb-4 text-primary" />
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors flex items-center gap-2">
                {link.title}
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-sm text-muted-foreground">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Overview */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Features</h2>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <ul className="space-y-2 text-muted-foreground">
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
