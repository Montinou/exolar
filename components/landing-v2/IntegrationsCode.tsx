"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { FadeIn, Section } from "./atmosphere"
import { cn } from "@/lib/utils"

/**
 * Code-native section. Monospace earns its place here.
 * Three tabs: MCP install · GitHub Action · Catalog YAML.
 * Every code block carries a copy-to-clipboard affordance.
 */

const TABS = [
  {
    id: "mcp",
    label: "MCP server",
    lang: "bash",
    caption: "One command — adds Exolar to Claude Code",
    code: `claude mcp add exolar-qa \\
  --transport http https://exolar.agentical.work/api/mcp/mcp \\
  -s user

# OAuth opens in your browser. No token copying.`,
  },
  {
    id: "gha",
    label: "GitHub Action",
    lang: "yaml",
    caption: "Drop this into .github/workflows/playwright.yml",
    code: `- name: Run Playwright
  run: yarn playwright test --reporter=json

- name: Send to Exolar
  if: always()
  uses: exolar/upload@v1
  with:
    api-key: \${{ secrets.EXOLAR_API_KEY }}
    results: playwright-results.json
    artifacts: playwright-report/`,
  },
  {
    id: "catalog",
    label: "Suite catalog",
    lang: "yaml",
    caption: "Tell Exolar which suites map to which paths",
    code: `# .exolar/catalog.yml
suites:
  - name: checkout
    paths:
      - app/checkout/**
      - lib/promo/**
    criticality: high

  - name: marketplace
    paths: [app/marketplace/**]
    adjacent: [checkout]   # ran together when checkout changes

  - name: smart-selection
    paths: [automation/playwright/smart-selection/**]
    criticality: standard`,
  },
] as const

export function IntegrationsCode() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("mcp")
  const tab = TABS.find((t) => t.id === active)!

  return (
    <Section variant="code" className="!py-32 sm:!py-40">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <FadeIn>
          <div className="lg:sticky lg:top-32">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              06 · Integrate
            </p>
            <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
              Wires into the stuff you already run.
            </h2>
            <p className="mt-7 max-w-[48ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              GitHub Actions for the ingest. MCP for Claude / Cursor / any compatible client.
              YAML for the catalog. No agents to deploy, no SDKs to wrap.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div>
            <div className="flex flex-wrap items-center gap-1 border-b border-border/50">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  aria-pressed={t.id === active}
                  className={cn(
                    "relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
                    t.id === active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {t.id === active && (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-[var(--exolar-cyan)]" />
                  )}
                </button>
              ))}
            </div>

            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {tab.caption}
            </p>

            <CodeBlock code={tab.code} lang={tab.lang} />
          </div>
        </FadeIn>
      </div>
    </Section>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="group relative mt-4 overflow-hidden rounded-xl border border-border/50 bg-background/70">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <span>{lang}</span>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.65] text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  )
}
