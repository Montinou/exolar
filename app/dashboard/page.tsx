import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, type DateRangeFilter } from "@/lib/db"
import { PageContainer, PageHeader, PageSection } from "@/components/shell"
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
  searchParams: Promise<{
    status?: string
    branch?: string
    suite?: string
    from?: string
    to?: string
    historic?: string
  }>
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

  const branches = branchStats.map((b) => b.branch)
  const suites = suiteStats.map((s) => s.suite)

  const totalTests = metrics.aggregateTestCounts.total_tests
  const passedTests = metrics.aggregateTestCounts.passed_tests
  const failedTests = metrics.aggregateTestCounts.failed_tests
  const skippedTests = metrics.aggregateTestCounts.skipped_tests
  const flakyTests = metrics.flakyTests ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="What changed in your CI"
        lede="A debrief of recent runs — pass rate, failure clusters, suite health, and where the time went."
      />

      <Filters branches={branches} suites={suites} />

      <PageSection eyebrow="Health · last window">
        <StatsCards metrics={metrics} />
        <div className="mt-6">
          <TestSummaryBar
            total={totalTests}
            passed={passedTests}
            failed={failedTests}
            skipped={skippedTests}
            flaky={flakyTests}
          />
        </div>
      </PageSection>

      <PageSection eyebrow="Read by chart">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      </PageSection>

      <PageSection eyebrow="Hot tests + AI signal">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <FlakiestTestsCard branch={params.branch || undefined} since={params.from || undefined} />
          <SlowestTestsCard
            dateFrom={params.from}
            dateTo={params.to}
            branch={params.branch}
            suite={params.suite}
          />
          <AiInsightsCard />
        </div>
      </PageSection>

      <PageSection eyebrow="Suite health">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SuitePassRatesCard
            dateFrom={params.from}
            dateTo={params.to}
            branch={params.branch}
          />
          <CategoryDistributionChart />
        </div>
      </PageSection>

      <PageSection eyebrow="Executions" title="Recent runs">
        <ExecutionsView executions={executions} branchGroups={branchGroups} />
      </PageSection>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-border/60" />
        <div className="h-9 w-80 max-w-full animate-pulse rounded bg-border/60" />
        <div className="h-4 w-[28rem] max-w-full animate-pulse rounded bg-border/40" />
      </div>

      {/* Filters skeleton */}
      <div className="h-12 w-full animate-pulse rounded-lg bg-border/40" />

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface-raised h-28 animate-pulse opacity-60" />
        ))}
      </div>

      {/* Chart row skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface-raised h-64 animate-pulse opacity-60" />
        ))}
      </div>

      {/* Analysis row skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface-raised h-80 animate-pulse opacity-60" />
        ))}
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    branch?: string
    suite?: string
    from?: string
    to?: string
    historic?: string
  }>
}) {
  return (
    <PageContainer width="wide">
      <Suspense fallback={<DashboardSkeleton />}>
        {/* @ts-expect-error Async Server Component */}
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}
