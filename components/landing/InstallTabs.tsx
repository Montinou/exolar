"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const step1Command = `claude mcp add exolar-qa \\
  --url https://exolar.ai-innovation.site/api/mcp/mcp \\
  --header "Authorization: Bearer YOUR_TOKEN_HERE"`

const manualConfig = `{
  "mcpServers": {
    "exolar-qa": {
      "url": "https://exolar.ai-innovation.site/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}`

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
            Install the MCP server with a single command.
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="claude-code" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 glass-panel p-1">
              <TabsTrigger
                value="claude-code"
                className="data-[state=active]:bg-[oklch(0.15_0.02_260)] rounded-lg transition-all"
              >
                Claude Code
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="data-[state=active]:bg-[oklch(0.15_0.02_260)] rounded-lg transition-all"
              >
                Manual Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="claude-code" className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium" style={{ color: "oklch(0.8 0 0)" }}>
                    1. Get your token from <a href="https://exolar.ai-innovation.site/settings/mcp" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">Settings → MCP Integration</a>
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <p className="text-sm font-medium" style={{ color: "oklch(0.8 0 0)" }}>
                    2. Run the setup command
                  </p>
                </div>
                <CodeBlock code={step1Command} language="bash" />
              </div>

              <p className="text-xs" style={{ color: "oklch(0.5 0 0)" }}>
                That&apos;s it! Claude Code now has access to your test data via HTTP Streamable transport.
              </p>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <p className="text-sm" style={{ color: "oklch(0.6 0 0)" }}>
                Add this to your Claude Code MCP settings:
              </p>
              <CodeBlock code={manualConfig} language="json" />
              <p className="text-xs" style={{ color: "oklch(0.5 0 0)" }}>
                Note: Get your authentication token from <a href="https://exolar.ai-innovation.site/settings/mcp" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">Settings → MCP Integration</a>
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  )
}
