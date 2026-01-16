import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, type DateRangeFilter } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TestSummaryBar } from "@/components/dashboard/test-summary-bar"
import { StatusDonutChart } from "@/components/dashboard/status-donut-chart"
import { ErrorDistributionChart } from "@/components/dashboard/error-distribution-chart"
import { FailureRateChart } from "@/components/dashboard/failure-rate-chart"
import { CategoryDistributionChart } from "@/components/dashboard/charts/category-distribution-chart"
import { ExecutionsView } from "@/components/dashboard/executions-view"
import { Filters } from "@/components/dashboard/filters"
import { FlakiestTestsCard } from "@/components/dashboard/flakiest-tests-card"
import { SlowestTestsCard } from "@/components/dashboard/slowest-tests-card"
import { SuitePassRatesCard } from "@/components/dashboard/suite-pass-rates-card"
import { AiInsightsCard } from "@/components/dashboard/ai-insights-card"
import { Skeleton } from "@/components/ui/skeleton"

export const dynamic = "force-dynamic"

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string; suite?: string; from?: string; to?: string; historic?: string }>
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

  const dateRange: DateRangeFilter | undefined =
    params.from || params.to ? { from: params.from, to: params.to } : undefined

  const [metrics, executions, branchGroups, branchStats, suiteStats] = await Promise.all([
    db.getDashboardMetrics({
      from: dateRange?.from,
      to: dateRange?.to,
      branch: params.branch,
      suite: params.suite,
      lastRunOnly,
    }),
    db.getExecutions(50, 0, params.status, params.branch, dateRange, params.suite),
    db.getExecutionsGroupedByBranch(dateRange),
    db.getBranches(),
    db.getSuites(),
  ])

  // Extract names for dropdown filters
  const branches = branchStats.map((b) => b.branch)
  const suites = suiteStats.map((s) => s.suite)

  // Extract metrics for new components
  const totalTests = metrics.latestPassRate?.total_tests ?? 0
  const passedTests = metrics.latestPassRate?.passed_tests ?? 0
  const failedTests = metrics.latestPassRate?.failed_tests ?? 0
  const skippedTests = metrics.latestPassRate?.skipped_tests ?? 0
  const flakyTests = metrics.flakyTests ?? 0

  return (
    <>
      <div className="space-y-6">
        {/* Filters - positioned at top below nav tabs */}
        <Filters branches={branches} suites={suites} />

        {/* Stats Overview */}
        <StatsCards metrics={metrics} />

        {/* Test Summary Progress Bar */}
        <TestSummaryBar
          total={totalTests}
          passed={passedTests}
          failed={failedTests}
          skipped={skippedTests}
          flaky={flakyTests}
        />

        {/* Charts Row - 3 columns on large screens */}
        {/* TODO: FailureRateChart is also in /dashboard/performance - consolidate in future dashboard redesign */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatusDonutChart
            passRate={totalTests > 0 ? (passedTests / totalTests) * 100 : 0}
            failRate={totalTests > 0 ? (failedTests / totalTests) * 100 : 0}
            skippedRate={totalTests > 0 ? (skippedTests / totalTests) * 100 : 0}
            flakyCount={flakyTests}
          />
          <FailureRateChart
            dateFrom={params.from}
            dateTo={params.to}
            branch={params.branch}
            suite={params.suite}
            failureRate={metrics.failure_rate}
          />
          <ErrorDistributionChart
            dateFrom={params.from}
            dateTo={params.to}
            branch={params.branch}
            suite={params.suite}
          />
        </div>

        {/* Analysis Row - Flakiest, Slowest, and AI Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FlakiestTestsCard branch={params.branch || undefined} since={params.from || undefined} />
          <SlowestTestsCard
            dateFrom={params.from}
            dateTo={params.to}
            branch={params.branch}
            suite={params.suite}
          />
          <AiInsightsCard />
        </div>

        {/* Suite Analysis Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SuitePassRatesCard
            dateFrom={params.from}
            dateTo={params.to}
            branch={params.branch}
          />
          <CategoryDistributionChart />
        </div>

        {/* Executions */}
        <ExecutionsView executions={executions} branchGroups={branchGroups} />
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card glass-card-glow p-6">
            <Skeleton className="h-20 w-full bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Test Summary Bar Skeleton */}
      <div className="glass-card glass-card-glow p-6">
        <Skeleton className="h-12 w-full bg-muted/30" />
      </div>

      {/* Charts Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card glass-card-glow p-6">
            <Skeleton className="h-[220px] w-full bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Analysis Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card glass-card-glow p-6">
            <Skeleton className="h-[200px] w-full bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Suite Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-card glass-card-glow p-6">
            <Skeleton className="h-[200px] w-full bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Executions Skeleton */}
      <div className="glass-card glass-card-glow p-6">
        <Skeleton className="h-[400px] w-full bg-muted/30" />
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string; suite?: string; from?: string; to?: string; historic?: string }>
}) {
  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        {/* @ts-expect-error Async Server Component */}
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

