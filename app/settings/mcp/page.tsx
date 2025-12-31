"use client"

import { useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, RefreshCw, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function MCPSettingsPage() {
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  // MCP endpoint is now on the same domain
  const MCP_ENDPOINT = "/api/mcp"

  // For Claude Code config, we need the full URL
  // Users will get this from window.location when copying
  const getFullUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${MCP_ENDPOINT}`
    }
    return `https://your-domain.vercel.app${MCP_ENDPOINT}`
  }

  // Users will need to replace <your-token> with their actual Neon Auth token
  const config = {
    mcpServers: {
      "e2e-dashboard": {
        url: getFullUrl(),
        transport: "sse",
        headers: {
          Authorization: "Bearer <your-token>",
        },
      },
    },
  }

  const configString = JSON.stringify(config, null, 2)

  async function copyConfig() {
    await navigator.clipboard.writeText(configString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch(MCP_ENDPOINT)
      setTestResult(res.ok ? "success" : "error")
    } catch {
      setTestResult("error")
    } finally {
      setTesting(false)
    }
  }

  const tools = [
    { name: "get_executions", description: "List test executions with filters" },
    { name: "get_execution_details", description: "Get detailed test results for an execution" },
    { name: "search_tests", description: "Search tests by name or file" },
    { name: "get_test_history", description: "Get history for a specific test" },
    { name: "get_failed_tests", description: "List failed tests with AI context" },
    { name: "get_dashboard_metrics", description: "Pass rate, failure counts, avg duration" },
    { name: "get_trends", description: "Time-series pass/fail data" },
    { name: "get_error_distribution", description: "Breakdown of error types" },
    { name: "get_flaky_tests", description: "Identify flaky tests" },
    { name: "get_flakiness_summary", description: "Overall flakiness metrics" },
    { name: "list_artifacts", description: "List artifacts for a test result" },
    { name: "get_artifact_url", description: "Get signed URL for test artifacts" },
  ]

  return (
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

      <h1 className="text-2xl font-bold mb-2">MCP Integration</h1>
      <p className="text-muted-foreground mb-6">
        Connect Claude Code to access your test data directly
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Configuration</CardTitle>
          <CardDescription>
            Add this to your ~/.claude.json or project .claude.json file.
            Replace &lt;your-token&gt; with your Neon Auth token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono">
              {configString}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={copyConfig}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 items-center">
            <Button onClick={testConnection} disabled={testing}>
              {testing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>

            {testResult === "success" && (
              <span className="text-sm text-green-400 bg-green-950/30 px-3 py-1.5 rounded-md border border-green-500/30">
                ✓ Connection successful! MCP server is reachable.
              </span>
            )}

            {testResult === "error" && (
              <span className="text-sm text-red-400 bg-red-950/30 px-3 py-1.5 rounded-md border border-red-500/30">
                ✗ Connection failed. Check your network or server status.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available Tools ({tools.length})</CardTitle>
          <CardDescription>
            These tools will be available in Claude Code after setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded shrink-0">
                  {tool.name}
                </code>
                <span className="text-sm text-muted-foreground">
                  {tool.description}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Step number={1} title="Copy Configuration">
            Click the copy button above to copy your MCP configuration
          </Step>
          <Step number={2} title="Add to Claude Code">
            Open or create ~/.claude.json and paste the configuration
          </Step>
          <Step number={3} title="Get Your Token">
            Use your browser&apos;s developer tools to find your Neon Auth token
            from the Authorization header
          </Step>
          <Step number={4} title="Restart Claude Code">
            Restart Claude Code to load the new MCP server
          </Step>
          <Step number={5} title="Start Using">
            Ask Claude to &quot;get recent test failures&quot; or &quot;search for login
            tests&quot;
          </Step>
        </CardContent>
      </Card>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
