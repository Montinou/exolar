"use client"

import Link from "next/link"
import { ArrowRight, Gauge, GitBranch, Zap, BarChart3, Building2, GitCompare } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// Feature card component for consistent styling
function FeatureCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="p-4 sm:p-6 rounded-xl glass-card glass-card-glow">
      <div className="flex items-center gap-3 mb-3">
        <span className="p-2 rounded-lg bg-primary/10 border border-primary/30">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  )
}

export default function FeaturesPage() {
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
        >Features</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Learn about the key features that make Exolar QA powerful for E2E test monitoring
          and analysis.
        </p>
      </div>

      {/* Reliability Score */}
      <section id="reliability-score" className="scroll-mt-20">
        <FeatureCard
          icon={Gauge}
          title="Reliability Score"
          description="A single 0-100 score that tells you how healthy your test suite is at a glance."
        >
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="calculation" className="border-border/50">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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

            <AccordionItem value="interpretation" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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
        </FeatureCard>
      </section>

      {/* Flaky Test Detection */}
      <section id="flaky-detection" className="scroll-mt-20">
        <FeatureCard
          icon={GitBranch}
          title="Flaky Test Detection"
          description="Automatically identifies tests that pass after retries, indicating non-deterministic behavior."
        >
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="algorithm" className="border-border/50">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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

            <AccordionItem value="metrics" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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
        </FeatureCard>
      </section>

      {/* Performance Regression */}
      <section id="performance-regression" className="scroll-mt-20">
        <FeatureCard
          icon={Zap}
          title="Performance Regression Detection"
          description="Automatically flags tests running slower than their historical baseline."
        >
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="thresholds" className="border-border/50">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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

            <AccordionItem value="baseline" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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
        </FeatureCard>
      </section>

      {/* Compare Runs */}
      <section id="compare-runs" className="scroll-mt-20">
        <FeatureCard
          icon={GitCompare}
          title="Compare Runs"
          description="Side-by-side comparison of two test executions to identify regressions, improvements, and changes."
        >
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="comparison-modes" className="border-border/50">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
                Comparison modes
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">By Execution ID</strong> — Compare specific runs using their IDs</p>
                  <p><strong className="text-foreground">By Branch</strong> — Compare latest executions from two branches (e.g., main vs feature-x)</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="diff-categories" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
                Diff categories
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  <div className="p-2 rounded-lg glass-panel">
                    <p className="font-medium text-red-500">New Failures</p>
                    <p className="text-xs text-muted-foreground">Tests that passed in baseline but failed in current</p>
                  </div>
                  <div className="p-2 rounded-lg glass-panel">
                    <p className="font-medium text-green-500">Fixed</p>
                    <p className="text-xs text-muted-foreground">Tests that failed in baseline but passed in current</p>
                  </div>
                  <div className="p-2 rounded-lg glass-panel">
                    <p className="font-medium text-blue-500">New Tests</p>
                    <p className="text-xs text-muted-foreground">Tests only present in current execution</p>
                  </div>
                  <div className="p-2 rounded-lg glass-panel">
                    <p className="font-medium text-gray-500">Removed Tests</p>
                    <p className="text-xs text-muted-foreground">Tests only present in baseline execution</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureCard>
      </section>

      {/* Multi-tenancy */}
      <section id="multi-tenancy" className="scroll-mt-20">
        <FeatureCard
          icon={Building2}
          title="Multi-tenancy"
          description="Organization-level isolation with Row-Level Security (RLS)."
        >
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="isolation" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
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
        </FeatureCard>
      </section>

      {/* AI Analysis */}
      <section id="ai-analysis" className="scroll-mt-20">
        <FeatureCard
          icon={BarChart3}
          title="AI-Powered Analysis"
          description="Intelligent error categorization and failure analysis via MCP integration."
        >
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="error-categorization" className="border-border/50">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
                Error Categorization
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground pt-2">
                  Failures are automatically categorized into types like TimeoutError, AssertionError,
                  NetworkError, etc. This helps identify patterns and recurring issues.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="mcp" className="border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-2">
                MCP Integration
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    AI coding assistants like Claude Code can query test data directly using 
                    the Model Context Protocol (MCP).
                  </p>
                  <Link
                    href="/docs/mcp"
                    className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                  >
                    Learn about MCP Integration
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureCard>
      </section>
    </div>
  )
}
