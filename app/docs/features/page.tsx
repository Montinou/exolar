"use client"

import Link from "next/link"
import { ArrowRight, Gauge, GitBranch, Zap, BarChart3, Building2, Shield } from "lucide-react"
import { TableOfContents, TOCItem } from "@/components/docs/table-of-contents"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const tocItems: TOCItem[] = [
  { id: "reliability-score", text: "Reliability Score" },
  { id: "flaky-detection", text: "Flaky Test Detection" },
  { id: "performance-regression", text: "Performance Regression" },
  { id: "multi-tenancy", text: "Multi-tenancy" },
  { id: "ai-analysis", text: "AI-Powered Analysis" },
]

export default function FeaturesPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      <TableOfContents items={tocItems} />

      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Features</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Learn about the key features that make Exolar QA powerful for E2E test monitoring
          and analysis.
        </p>
      </div>

      {/* Reliability Score */}
      <section id="reliability-score" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-semibold">Reliability Score</h2>
        </div>
        <p className="text-muted-foreground">
          A single 0-100 score that tells you how healthy your test suite is at a glance.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="calculation" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              How is it calculated?
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  The reliability score combines three metrics:
                </p>
                <div className="p-4 rounded-lg glass-panel">
                  <code className="text-xs sm:text-sm">
                    Score = (PassRate × 40%) + ((100 - FlakyRate) × 30%) + (DurationStability × 30%)
                  </code>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Pass Rate (40%)</strong> — Percentage of tests passing
                  </li>
                  <li>
                    <strong className="text-foreground">Flakiness (30%)</strong> — Inverse of flaky test percentage
                  </li>
                  <li>
                    <strong className="text-foreground">Duration Stability (30%)</strong> — Consistency of test run times
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="interpretation" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              Score interpretation
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <span className="text-2xl font-bold text-green-500">80-100</span>
                  <div>
                    <p className="font-medium text-green-500">Healthy</p>
                    <p className="text-xs text-muted-foreground">Suite is stable and reliable</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <span className="text-2xl font-bold text-amber-500">60-79</span>
                  <div>
                    <p className="font-medium text-amber-500">Warning</p>
                    <p className="text-xs text-muted-foreground">Some flaky or failing tests need attention</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <span className="text-2xl font-bold text-red-500">&lt;60</span>
                  <div>
                    <p className="font-medium text-red-500">Critical</p>
                    <p className="text-xs text-muted-foreground">Immediate action required</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Flaky Test Detection */}
      <section id="flaky-detection" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-semibold">Flaky Test Detection</h2>
        </div>
        <p className="text-muted-foreground">
          Automatically identifies tests that pass after retries, indicating non-deterministic behavior.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="algorithm" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              Detection algorithm
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                <p>A test is marked as <strong className="text-foreground">flaky</strong> if:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>It has <code className="px-1 rounded bg-muted">retry_count {">"} 0</code> (required retries to pass)</li>
                  <li>The final status is <code className="px-1 rounded bg-muted">passed</code></li>
                </ul>
                <p>
                  The <strong className="text-foreground">flakiness rate</strong> is calculated as:
                </p>
                <div className="p-3 rounded-lg glass-panel">
                  <code>(flaky_runs / total_runs) × 100</code>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="metrics" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              Available metrics
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pt-2 text-sm text-muted-foreground">
                <li>• <strong className="text-foreground">Flakiness Rate</strong> — % of runs requiring retries</li>
                <li>• <strong className="text-foreground">Total Flaky Runs</strong> — Count of flaky executions</li>
                <li>• <strong className="text-foreground">Last Flaky</strong> — When it was last flaky</li>
                <li>• <strong className="text-foreground">Worst Offenders</strong> — Top 5 flakiest tests</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Performance Regression */}
      <section id="performance-regression" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-semibold">Performance Regression Detection</h2>
        </div>
        <p className="text-muted-foreground">
          Automatically flags tests running slower than their historical baseline.
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="thresholds" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              Severity thresholds
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-lg glass-panel">
                  <p className="font-medium text-red-500">Critical ({">"} 50% slower)</p>
                  <p className="text-xs text-muted-foreground">
                    Test is running more than 50% slower than baseline
                  </p>
                </div>
                <div className="p-3 rounded-lg glass-panel">
                  <p className="font-medium text-amber-500">Warning (20-50% slower)</p>
                  <p className="text-xs text-muted-foreground">
                    Test is running 20-50% slower than baseline
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="baseline" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              Baseline calculation
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground pt-2">
                Baselines are calculated from the rolling average of test durations over the past
                30 days, excluding outliers. The system compares recent runs (last 24-48 hours)
                against this baseline to detect regressions.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Multi-tenancy */}
      <section id="multi-tenancy" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-semibold">Multi-tenancy</h2>
        </div>
        <p className="text-muted-foreground">
          Organization-level isolation with Row-Level Security (RLS).
        </p>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="isolation" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline">
              Data isolation
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pt-2 text-sm text-muted-foreground">
                <li>• Each organization has its own isolated data</li>
                <li>• API keys are scoped to organizations</li>
                <li>• RLS policies enforce access at the database level</li>
                <li>• Users can belong to multiple organizations</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* AI Analysis */}
      <section id="ai-analysis" className="space-y-4 sm:space-y-6 scroll-mt-20">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-semibold">AI-Powered Analysis</h2>
        </div>
        <p className="text-muted-foreground">
          Intelligent error categorization and failure analysis via MCP integration.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">Error Categorization</h3>
            <p className="text-sm text-muted-foreground">
              Failures are automatically categorized into types like TimeoutError, AssertionError, etc.
            </p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <h3 className="font-medium mb-2">MCP Integration</h3>
            <p className="text-sm text-muted-foreground">
              AI coding assistants like Claude Code can query test data directly.
            </p>
          </div>
        </div>

        <Link
          href="/docs/mcp"
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
        >
          Learn about MCP Integration
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
