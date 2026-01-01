"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const manualConfig = `{
  "mcpServers": {
    "e2e-dashboard": {
      "command": "npx",
      "args": ["-y", "@e2e-dashboard/mcp-server"],
      "env": {
        "DATABASE_URL": "your-database-url"
      }
    }
  }
}`

const aiPrompt = `Install the E2E Test Dashboard skill.
Connect it to my Playwright test results database.
Enable auto-triage for flaky test detection.`

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre
        className="p-6 rounded-xl overflow-x-auto text-sm font-mono"
        style={{
          background: "oklch(0.06 0.015 260)",
          color: "oklch(0.75 0 0)",
        }}
      >
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-4 right-4 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 glass-panel"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4" style={{ color: "oklch(0.65 0.15 140)" }} />
        ) : (
          <Copy className="w-4 h-4" style={{ color: "oklch(0.6 0 0)" }} />
        )}
      </button>
    </div>
  )
}

export function InstallTabs() {
  return (
    <section className="py-24 grid-pattern">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <h2
            className="text-3xl md:text-4xl font-bold"
            style={{ color: "oklch(0.95 0 0)" }}
          >
            Get Started in Seconds
          </h2>
          <p style={{ color: "oklch(0.6 0 0)" }}>
            Choose your preferred installation method. Manual config or let AI do it for you.
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 glass-panel p-1">
              <TabsTrigger
                value="manual"
                className="data-[state=active]:bg-[oklch(0.15_0.02_260)] rounded-lg transition-all"
              >
                Manual Config
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="data-[state=active]:bg-[oklch(0.15_0.02_260)] rounded-lg transition-all"
              >
                AI Auto-Install
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              <p className="text-sm" style={{ color: "oklch(0.6 0 0)" }}>
                Add this to your <code className="px-2 py-1 rounded glass-panel text-xs">claude_desktop_config.json</code>:
              </p>
              <CodeBlock code={manualConfig} language="json" />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <p className="text-sm" style={{ color: "oklch(0.6 0 0)" }}>
                Simply tell Claude or Cursor:
              </p>
              <CodeBlock code={aiPrompt} language="text" />
              <p className="text-xs" style={{ color: "oklch(0.5 0 0)" }}>
                The AI will handle the configuration automatically.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  )
}
