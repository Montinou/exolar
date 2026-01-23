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

  // Extract metrics for new components - use aggregateTestCounts for consistency with Stats Cards
  const totalTests = metrics.aggregateTestCounts.total_tests
  const passedTests = metrics.aggregateTestCounts.passed_tests
  const failedTests = metrics.aggregateTestCounts.failed_tests
  const skippedTests = metrics.aggregateTestCounts.skipped_tests
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
          <div className="animate-fade-in-up delay-3">
            <FailureRateChart
              dateFrom={params.from}
              dateTo={params.to}
              branch={params.branch}
              suite={params.suite}
              failureRate={metrics.failure_rate}
            />
          </div>
          <div className="animate-fade-in-up delay-4">
            <ErrorDistributionChart
              dateFrom={params.from}
              dateTo={params.to}
              branch={params.branch}
              suite={params.suite}
            />
          </div>
        </div>

        {/* Analysis Row - Flakiest, Slowest, and AI Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="animate-fade-in-up delay-5">
            <FlakiestTestsCard branch={params.branch || undefined} since={params.from || undefined} />
          </div>
          <div className="animate-fade-in-up delay-6">
            <SlowestTestsCard
              dateFrom={params.from}
              dateTo={params.to}
              branch={params.branch}
              suite={params.suite}
            />
          </div>
          <div className="animate-fade-in-up delay-7">
            <AiInsightsCard />
          </div>
        </div>

        {/* Suite Analysis Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-fade-in-up delay-6">
            <SuitePassRatesCard
              dateFrom={params.from}
              dateTo={params.to}
              branch={params.branch}
            />
          </div>
          <div className="animate-fade-in-up delay-7">
            <CategoryDistributionChart />
          </div>
        </div>

        {/* Executions */}
        <div className="animate-fade-in-up delay-8">
          <ExecutionsView executions={executions} branchGroups={branchGroups} />
        </div>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  const delayClasses = ["delay-1", "delay-2", "delay-3", "delay-4", "delay-5", "delay-6", "delay-7", "delay-8"]

  return (
    <div className="space-y-6">
      {/* Filter Bar Skeleton */}
      <div
        className="h-16 rounded-xl animate-fade-in-up animate-shimmer"
        style={{ animationDelay: "0ms" }}
      />

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`glass-card glass-card-glow p-6 animate-fade-in-up ${delayClasses[i]}`}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 w-20 rounded animate-shimmer" />
                <div className="h-8 w-8 rounded-lg animate-shimmer" />
              </div>
              <div className="h-10 w-24 rounded animate-shimmer" />
              <div className="h-3 w-32 rounded animate-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Test Summary Bar Skeleton */}
      <div className="glass-card glass-card-glow p-4 animate-fade-in-up delay-5">
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded animate-shimmer" />
            <div className="flex gap-4">
              <div className="h-4 w-24 rounded animate-shimmer" />
              <div className="h-4 w-24 rounded animate-shimmer" />
            </div>
          </div>
          <div className="h-3 w-full rounded-full animate-shimmer" />
        </div>
      </div>

      {/* Charts Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`glass-card glass-card-glow p-6 animate-fade-in-up ${delayClasses[i + 2]}`}
          >
            <div className="space-y-4">
              <div className="h-4 w-40 rounded animate-shimmer" />
              <div className="h-[200px] rounded-lg animate-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Analysis Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`glass-card glass-card-glow p-6 animate-fade-in-up ${delayClasses[i + 5]}`}
          >
            <div className="space-y-4">
              <div className="h-4 w-32 rounded animate-shimmer" />
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-8 w-full rounded animate-shimmer" style={{ animationDelay: `${j * 50}ms` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Suite Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className={`glass-card glass-card-glow p-6 animate-fade-in-up ${delayClasses[i + 6]}`}
          >
            <div className="space-y-4">
              <div className="h-4 w-36 rounded animate-shimmer" />
              <div className="h-[180px] rounded-lg animate-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Executions Skeleton */}
      <div className="glass-card glass-card-glow p-6 animate-fade-in-up delay-8">
        <div className="space-y-4">
          <div className="flex justify-between">
            <div className="h-5 w-32 rounded animate-shimmer" />
            <div className="h-8 w-40 rounded animate-shimmer" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 w-full rounded-lg animate-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        </div>
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
