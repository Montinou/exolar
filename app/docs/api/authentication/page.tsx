import Link from "next/link"
import { ArrowRight, Key, Shield, AlertTriangle } from "lucide-react"

export const metadata = {
  title: "API Authentication - Exolar QA",
  description: "Learn how to create and manage API keys for Exolar QA",
}

export default function ApiAuthenticationPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/docs/api" className="hover:text-foreground transition-colors">
            API Reference
          </Link>
          <span>/</span>
          <span className="text-foreground">Authentication</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">API Authentication</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Exolar uses API keys to authenticate requests. API keys are scoped to your organization
          and can be managed from your dashboard settings.
        </p>
      </div>

      {/* Creating API Keys */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Key className="h-6 w-6 text-primary" />
          Creating API Keys
        </h2>
        <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
          <li>
            Go to{" "}
            <Link href="/settings/api-keys" className="text-primary hover:underline">
              Settings &rarr; API Keys
            </Link>
          </li>
          <li>Click <strong className="text-foreground">&quot;Create API Key&quot;</strong></li>
          <li>Enter a descriptive name (e.g., &quot;GitHub Actions - Main Repo&quot;)</li>
          <li>Copy the key immediately &mdash; it won&apos;t be shown again</li>
        </ol>
        <div className="p-4 rounded-lg glass-panel border-l-4 border-amber-500">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium text-sm">Important</span>
          </div>
          <p className="text-sm text-muted-foreground">
            API keys are only displayed once at creation time. If you lose your key,
            you&apos;ll need to create a new one and update your CI configuration.
          </p>
        </div>
      </section>

      {/* Key Format */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Key Format</h2>
        <p className="text-muted-foreground">
          Exolar API keys are prefixed with <code className="px-1.5 py-0.5 rounded bg-muted text-xs">exolar_</code> for easy identification:
        </p>
        <pre className="p-4 rounded-lg glass-panel text-sm overflow-x-auto">
          <code>exolar_abc123def456...</code>
        </pre>
        <p className="text-sm text-muted-foreground">
          The prefix helps you identify Exolar keys in your environment variables and secrets.
        </p>
      </section>

      {/* Using API Keys */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Using API Keys</h2>

        <div className="space-y-4">
          <div className="p-4 sm:p-6 rounded-xl glass-card">
            <h3 className="font-medium mb-3">With the Playwright Reporter</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Set the <code className="px-1.5 py-0.5 rounded bg-muted text-xs">EXOLAR_API_KEY</code> environment variable:
            </p>
            <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto">
              <code>{`# In GitHub Actions
env:
  EXOLAR_API_KEY: \${{ secrets.EXOLAR_API_KEY }}

# Or in the reporter config
[exolar, { apiKey: process.env.EXOLAR_API_KEY }]`}</code>
            </pre>
          </div>

          <div className="p-4 sm:p-6 rounded-xl glass-card">
            <h3 className="font-medium mb-3">With the REST API</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Include the key in the <code className="px-1.5 py-0.5 rounded bg-muted text-xs">Authorization</code> header:
            </p>
            <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto">
              <code>{`curl -X POST https://exolar-qa.vercel.app/api/test-results \\
  -H "Authorization: Bearer exolar_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{ ... }'`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Security Best Practices */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Security Best Practices
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Never commit keys</h3>
            <p className="text-sm text-muted-foreground">
              Always use environment variables or secret managers. Never hardcode keys in your codebase.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Use descriptive names</h3>
            <p className="text-sm text-muted-foreground">
              Name keys by their purpose (e.g., &quot;CI - Production&quot;, &quot;CI - Staging&quot;) for easier management.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Rotate regularly</h3>
            <p className="text-sm text-muted-foreground">
              Periodically create new keys and revoke old ones, especially after team changes.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Revoke unused keys</h3>
            <p className="text-sm text-muted-foreground">
              Remove keys that are no longer in use to minimize your attack surface.
            </p>
          </div>
        </div>
      </section>

      {/* Organization Scoping */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Organization Scoping</h2>
        <p className="text-muted-foreground">
          API keys are scoped to the organization that created them:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>Data uploaded with a key belongs to that organization</li>
          <li>Keys can only access data within their organization</li>
          <li>Organization admins can manage keys for their organization</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          If you&apos;re seeing results in the wrong organization, check that you&apos;re using the correct API key.
        </p>
      </section>

      {/* Managing Keys */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Managing Keys</h2>
        <p className="text-muted-foreground">
          From the{" "}
          <Link href="/settings/api-keys" className="text-primary hover:underline">
            API Keys settings page
          </Link>
          , you can:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">View</strong> &mdash; See all active keys and when they were last used</li>
          <li><strong className="text-foreground">Create</strong> &mdash; Generate new keys with descriptive names</li>
          <li><strong className="text-foreground">Revoke</strong> &mdash; Immediately disable a key (cannot be undone)</li>
        </ul>
      </section>

      {/* Next Steps */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-xl font-semibold">Next Steps</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/docs/reporter/npm"
            className="group p-4 rounded-xl glass-card hover:glass-card-glow transition-all"
          >
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              Configure Reporter
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Use your API key with the Playwright reporter
            </p>
          </Link>
          <Link
            href="/docs/api"
            className="group p-4 rounded-xl glass-card hover:glass-card-glow transition-all"
          >
            <h3 className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
              API Endpoints
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Full API reference for custom integrations
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
