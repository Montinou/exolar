"use client"

import { useState, useEffect } from "react"
import { AnimatedLogo } from "@/components/ui/animated-logo"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, RefreshCw, ArrowLeft, Terminal, Sparkles, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default function MCPSettingsPage() {
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [generatingToken, setGeneratingToken] = useState(false)

  // Generate MCP token on mount
  useEffect(() => {
    generateToken()
  }, [])

  async function generateToken() {
    setGeneratingToken(true)
    setTokenError(null)
    try {
      const res = await fetch("/api/auth/mcp-token", { method: "POST" })
      const data = await res.json()

      if (res.ok && data.token) {
        setToken(data.token)
      } else {
        setTokenError(data.error || "Failed to generate token")
      }
    } catch (error) {
      setTokenError("Network error. Please try again.")
    } finally {
      setGeneratingToken(false)
    }
  }

  const dashboardUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://exolar.ai-innovation.site"

  const mcpConfig = token ? JSON.stringify({
    mcpServers: {
      "exolar-qa": {
        url: `${dashboardUrl}/api/mcp/mcp`,
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  }, null, 2) : "// Generating token..."

  async function copyConfig() {
    await navigator.clipboard.writeText(mcpConfig)
    setCopiedConfig(true)
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  const tools = [
    {
      name: "explore_exolar_index",
      description: "Discovery tool for available datasets, branches, suites, and metric definitions",
      badge: "Discovery"
    },
    {
      name: "query_exolar_data",
      description: "Universal data retrieval with 14 datasets (executions, failures, trends, flaky tests, etc.)",
      badge: "Data Access"
    },
    {
      name: "perform_exolar_action",
      description: "Heavy operations: compare runs, generate reports, classify test failures",
      badge: "Actions"
    },
    {
      name: "get_semantic_definition",
      description: "Get metric definitions with formulas and thresholds (prevents AI hallucinations)",
      badge: "AI Safety"
    },
    {
      name: "get_installation_config",
      description: "Get CI/CD integration guide and setup instructions",
      badge: "Setup"
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 max-w-3xl px-4">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <AnimatedLogo size="md" />
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >MCP Integration</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <Sparkles className="h-3 w-3 mr-1" />
              v2.0
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground mb-6">
          Query your test data directly from Claude Code with HTTP Streamable transport
        </p>

        {/* What's New Banner */}
        <div className="glass-card glass-card-glow mb-6 p-4 border-l-4 border-primary">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm mb-1">New in v2.0: Router Pattern & Semantic Layer</h3>
              <p className="text-sm text-muted-foreground mb-2">
                83% token savings with 5-tool consolidation, AI safety definitions, and HTTP Streamable transport.
              </p>
              <Link href="/docs/whats-new" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                Learn more <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <Card className="mb-6 glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              One-Click Setup
            </CardTitle>
            <CardDescription>
              Add this configuration to Claude Code's MCP settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatingToken && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating authentication token...
              </div>
            )}

            {tokenError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                {tokenError}
                <Button size="sm" variant="outline" onClick={generateToken} className="ml-3">
                  Retry
                </Button>
              </div>
            )}

            {token && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Configuration JSON</label>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={copyConfig}
                      className="h-8"
                    >
                      {copiedConfig ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="glass-panel p-4 text-xs overflow-x-auto font-mono">
                    {mcpConfig}
                  </pre>
                </div>

                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Option A: Command Line (Recommended)</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Run this command in your terminal:
                    </p>
                    <pre className="glass-panel p-3 text-xs overflow-x-auto font-mono">
                      {`claude mcp add exolar-qa --url ${dashboardUrl}/api/mcp/mcp --header "Authorization: Bearer ${token.substring(0, 20)}..."`}
                    </pre>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Option B: Manual Configuration</p>
                    <ol className="text-xs sm:text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Open Claude Code settings</li>
                      <li>Navigate to MCP Servers section</li>
                      <li>Click "Add Server" or edit your configuration file</li>
                      <li>Paste the JSON configuration above</li>
                      <li>Restart Claude Code to apply changes</li>
                    </ol>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                    <span className="text-amber-500 shrink-0">⚠️</span>
                    <p className="text-amber-500/90">
                      Keep your token secure. This token provides access to your organization's test data.
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 glass-card glass-card-glow">
          <CardHeader>
            <CardTitle>Available Tools ({tools.length})</CardTitle>
            <CardDescription>
              5 consolidated tools replace 24 individual tools for 83% token savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-start gap-3 p-3 rounded-lg glass-panel group hover:border-primary/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono bg-muted/50 px-2 py-0.5 rounded">
                        {tool.name}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {tool.badge}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {tool.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>
              Documentation and resources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/docs/mcp"
              className="flex items-center justify-between p-3 rounded-lg glass-panel hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">MCP Documentation</p>
                  <p className="text-xs text-muted-foreground">Architecture, tools, datasets, and examples</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/docs/whats-new"
              className="flex items-center justify-between p-3 rounded-lg glass-panel hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">What's New in v2.0</p>
                  <p className="text-xs text-muted-foreground">Router pattern, semantic layer, and migration guide</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>

            <div className="p-3 rounded-lg glass-panel border-border/30">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Token Refresh</p>
                  <p className="text-xs text-muted-foreground">
                    Tokens expire after 30 days. Return to this page to generate a new one.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
