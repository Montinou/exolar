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
import { Copy, Check, RefreshCw, ArrowLeft, Terminal } from "lucide-react"
import Link from "next/link"

export default function MCPSettingsPage() {
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [copiedAdd, setCopiedAdd] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  const installCommand = "npx e2e-test-dashboard-mcp --login"
  const addCommand = "claude mcp add --transport stdio e2e-dashboard -- npx -y e2e-test-dashboard-mcp"

  async function copyInstallCommand() {
    await navigator.clipboard.writeText(installCommand)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  async function copyAddCommand() {
    await navigator.clipboard.writeText(addCommand)
    setCopiedAdd(true)
    setTimeout(() => setCopiedAdd(false), 2000)
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch("/api/mcp")
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
    { name: "list_branches", description: "Branches with test runs in last 30 days" },
    { name: "list_suites", description: "Test suites with recent runs" },
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
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Quick Setup
          </CardTitle>
          <CardDescription>
            Install and connect in 2 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
              Authenticate
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Run this command to open your browser and log in:
            </p>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono">
                {installCommand}
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={copyInstallCommand}
              >
                {copiedInstall ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
              Add to Claude Code
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Then add the MCP server to Claude Code:
            </p>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono whitespace-pre-wrap">
                {addCommand}
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={copyAddCommand}
              >
                {copiedAdd ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              That&apos;s it! After authentication, Claude Code will have access to your test data.
              Your credentials are stored securely in <code className="bg-muted px-1 rounded">~/.e2e-dashboard-mcp/config.json</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Connection</CardTitle>
          <CardDescription>
            Verify that the MCP server is reachable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
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
          <CardTitle>Other Commands</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <code className="text-sm font-mono">npx e2e-test-dashboard-mcp --status</code>
              <p className="text-xs text-muted-foreground mt-1">Check authentication status</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <code className="text-sm font-mono">npx e2e-test-dashboard-mcp --logout</code>
              <p className="text-xs text-muted-foreground mt-1">Clear stored credentials</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <code className="text-sm font-mono">npx e2e-test-dashboard-mcp --help</code>
              <p className="text-xs text-muted-foreground mt-1">Show all available options</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
