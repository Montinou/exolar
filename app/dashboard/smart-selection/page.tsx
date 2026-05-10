import { Suspense } from "react"
import { redirect } from "next/navigation"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  GitBranch,
  Sparkles,
  TrendingUp,
} from "lucide-react"

import { getSessionContext } from "@/lib/session-context"
import {
  listSmartSelectionDecisions,
  getRecentFalseNegativeStats,
  type SmartSelectionDecisionRecord,
} from "@/lib/db/smart-selection"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatsCard1 } from "@/components/stats-card1"

export const dynamic = "force-dynamic"

const MODE_BADGE: Record<
  SmartSelectionDecisionRecord["mode"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  shadow: { label: "Shadow", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  active_overridden: { label: "Override", variant: "outline" },
}

function pct(n: number, d: number): string {
  if (d === 0) return "—"
  return `${Math.round((n / d) * 100)}%`
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

async function SmartSelectionContent() {
  const context = await getSessionContext()
  if (!context) {
    redirect("/auth/signin")
  }

  const [recent, stats] = await Promise.all([
    listSmartSelectionDecisions({
      organizationId: context.organizationId,
      limit: 50,
    }),
    getRecentFalseNegativeStats(context.organizationId, 7),
  ])

  // Aggregate stats over the latest 50 decisions
  const totalDecisions = recent.length
  const totalDriftEvents = recent.filter(
    (r) =>
      r.catalog_drift.structural.length > 0 || r.catalog_drift.coverage.length > 0,
  ).length
  const totalConfidence = recent.reduce(
    (s, r) => s + Number(r.output.confidence ?? 0),
    0,
  )
  const avgConfidence = totalDecisions > 0 ? totalConfidence / totalDecisions : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-[var(--exolar-cyan)]" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Smart Test Selection
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            LLM-driven Playwright suite recommendations per PR. Audit + calibration
            for shadow mode; circuit breaker telemetry for active mode.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard1
          className="max-w-none"
          title="Decisions in last 7d"
          value={String(stats.shadow_decisions_count + stats.total_active_decisions)}
          change={0}
          changeLabel={`${stats.shadow_decisions_count} shadow · ${stats.total_active_decisions} active`}
        />
        <StatsCard1
          className="max-w-none"
          title="Active-mode FN (7d)"
          value={String(stats.active_false_negatives)}
          change={stats.active_false_negatives === 0 ? 0 : -100}
          changeLabel={
            stats.active_false_negatives === 0
              ? "circuit breaker idle"
              : "would trip circuit breaker"
          }
        />
        <StatsCard1
          className="max-w-none"
          title="Avg confidence (last 50)"
          value={avgConfidence > 0 ? avgConfidence.toFixed(2) : "—"}
          change={0}
          changeLabel="0–1 scale"
        />
        <StatsCard1
          className="max-w-none"
          title="PRs with catalog drift"
          value={`${totalDriftEvents}/${totalDecisions || 0}`}
          change={0}
          changeLabel={pct(totalDriftEvents, Math.max(totalDecisions, 1))}
        />
      </div>

      {/* Recent decisions table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
          <CardDescription>
            Latest 50 smart-selection events. Click a row's PR# to view it on
            GitHub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No smart-selection events yet. Once the recommend step runs on a PR,
                events will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>PR</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Selected</TableHead>
                  <TableHead className="text-right">FN</TableHead>
                  <TableHead className="text-right">Drift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => {
                  const mode = MODE_BADGE[r.mode]
                  const driftCount =
                    r.catalog_drift.structural.length +
                    r.catalog_drift.coverage.length
                  const fn = Number(r.metrics.false_negatives ?? 0)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">
                        {relativeTime(r.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.repository}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://github.com/${r.repository}/pull/${r.pr_number}`}
                          className="text-[var(--exolar-cyan)] underline-offset-2 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          #{r.pr_number}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={mode.variant}>{mode.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(r.output.confidence ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">
                          {r.output.selected_suites.length}/
                          {r.output.selected_suites.length + r.output.skipped_suites.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {fn > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[var(--status-error)]">
                            <AlertTriangle className="size-3.5" />
                            {fn}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="size-3.5" />0
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {driftCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <GitBranch className="size-3.5" />
                            {driftCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hint footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="size-3.5" />
        <span>
          Calibration window for shadow→active flip: 2 weeks live + ≥30 evaluated
          skips at confidence ≥0.9 + zero failure-based misses.
        </span>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-12 w-1/3" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}

export default function SmartSelectionPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SmartSelectionContent />
    </Suspense>
  )
}
