import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { Skeleton } from "@/components/ui/skeleton"
import { Filters } from "@/components/dashboard/filters"
import { PerformanceAlertsCard } from "@/components/dashboard/performance-alerts"
import { SlowestTestsCard } from "@/components/dashboard/slowest-tests-card"
import { FailureRateChart } from "@/components/dashboard/failure-rate-chart"
import { Gauge } from "lucide-react"

export const dynamic = "force-dynamic"

async function PerformanceContent({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string; suite?: string; historic?: string }>
}) {
  const context = await getSessionContext()
  if (!context) {
    redirect("/auth/signin")
  }

  const db = getQueriesForOrg(context.organizationId)
  const params = await searchParams

  // Filter logic: when branch/suite filter is applied, show last run only unless historic is checked
  const historic = params.historic === "true"
  const hasFilter = !!(params.branch || params.suite)
  const lastRunOnly = hasFilter && !historic

  // Date range for metrics (default 15 days if not specified)
  const dateRange = params.from || params.to
    ? { from: params.from, to: params.to }
    : undefined

  const [metrics, branchStats, suiteStats] = await Promise.all([
    db.getDashboardMetrics({
      from: dateRange?.from,
      to: dateRange?.to,
      branch: params.branch,
      suite: params.suite,
      lastRunOnly,
    }),
    db.getBranches(),
    db.getSuites(),
  ])

  // Extract names for dropdown filters
  const branches = branchStats.map((b) => b.branch)
  const suites = suiteStats.map((s) => s.suite)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Filters
        branches={branches}
        suites={suites}
        showStatus={false}
        basePath="/dashboard/performance"
      />

      {/* Performance Alerts - Main Feature */}
      <PerformanceAlertsCard branch={params.branch} suite={params.suite} lastRunOnly={lastRunOnly} />

      {/* Performance Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slowest Tests */}
        <SlowestTestsCard
          dateFrom={params.from}
          dateTo={params.to}
          branch={params.branch}
          suite={params.suite}
        />

        {/* Failure Rate Over Time */}
        <FailureRateChart
          dateFrom={params.from}
          dateTo={params.to}
          branch={params.branch}
          suite={params.suite}
          failureRate={metrics.failure_rate}
        />
      </div>

      {/* Info Card */}
      <div className="glass-card glass-card-glow p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--exolar-cyan)]" />
          About Performance Regression Detection
        </h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Performance regressions are detected by comparing recent test durations against
            their historical baseline (30-day rolling average).
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <span className="text-red-400 font-medium">Critical</span>: Tests running{" "}
              <span className="font-mono">&gt;50%</span> slower than baseline
            </li>
            <li>
              <span className="text-yellow-400 font-medium">Warning</span>: Tests running{" "}
              <span className="font-mono">20-50%</span> slower than baseline
            </li>
          </ul>
          <p className="text-xs mt-3">
            Baselines are calculated from tests with at least 3 runs in the last 30 days.
            Admins can trigger a baseline recalculation from the settings.
          </p>
        </div>
      </div>
    </div>
  )
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-6">
      {/* Alerts Skeleton */}
      <div className="glass-card glass-card-glow p-6">
        <Skeleton className="h-6 w-48 mb-4 bg-muted/30" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-muted/30" />
          ))}
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-card glass-card-glow p-6">
            <Skeleton className="h-[200px] w-full bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Info Skeleton */}
      <div className="glass-card glass-card-glow p-6">
        <Skeleton className="h-32 w-full bg-muted/30" />
      </div>
    </div>
  )
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string; suite?: string; historic?: string }>
}) {
  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <Suspense fallback={<PerformanceSkeleton />}>
        {/* @ts-expect-error Async Server Component */}
        <PerformanceContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
