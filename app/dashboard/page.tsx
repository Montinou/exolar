import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, type DateRangeFilter } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TestSummaryBar } from "@/components/dashboard/test-summary-bar"
import { StatusDonutChart } from "@/components/dashboard/status-donut-chart"
import { TrendAreaChart } from "@/components/dashboard/trend-area-chart"
import { ErrorDistributionChart } from "@/components/dashboard/error-distribution-chart"
import { FailureRateChart } from "@/components/dashboard/failure-rate-chart"
import { FlakinessBySuiteChart } from "@/components/dashboard/flakiness-by-suite-chart"
import { ExecutionsView } from "@/components/dashboard/executions-view"
import { Filters } from "@/components/dashboard/filters"
import { UserMenu } from "@/components/dashboard/user-menu"
import { AdminLink } from "@/components/dashboard/admin-link"
import { SearchTests } from "@/components/dashboard/search-tests"
import { FlakiestTestsCard } from "@/components/dashboard/flakiest-tests-card"
import { SlowestTestsCard } from "@/components/dashboard/slowest-tests-card"
import { SuitePassRatesCard } from "@/components/dashboard/suite-pass-rates-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string; suite?: string; from?: string; to?: string }>
}) {
  const context = await getSessionContext()
  if (!context) {
    redirect("/auth/signin")
  }

  const db = getQueriesForOrg(context.organizationId)
  const params = await searchParams

  const dateRange: DateRangeFilter | undefined =
    params.from || params.to ? { from: params.from, to: params.to } : undefined

  const [metrics, executions, branchGroups, branches, suites] = await Promise.all([
    db.getDashboardMetrics(dateRange),
    db.getExecutions(50, params.status, params.branch, dateRange, params.suite),
    db.getExecutionsGroupedByBranch(dateRange),
    db.getBranches(),
    db.getSuites(),
  ])

  // Extract metrics for new components
  const totalTests = metrics.latestPassRate?.total_tests ?? 0
  const passedTests = metrics.latestPassRate?.passed_tests ?? 0
  const failedTests = metrics.latestPassRate?.failed_tests ?? 0
  const flakyTests = metrics.flakyTests ?? 0

  return (
    <>
      <div className="space-y-6">
        {/* Stats Overview */}
        <StatsCards metrics={metrics} />

        {/* Test Summary Progress Bar */}
        <TestSummaryBar
          total={totalTests}
          passed={passedTests}
          failed={failedTests}
          flaky={flakyTests}
        />

        {/* Charts Row - 3 columns on large screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatusDonutChart
            passRate={totalTests > 0 ? (passedTests / totalTests) * 100 : 0}
            failRate={totalTests > 0 ? (failedTests / totalTests) * 100 : 0}
            flakyRate={totalTests > 0 ? (flakyTests / totalTests) * 100 : 0}
          />
          <FailureRateChart dateFrom={params.from} dateTo={params.to} />
          <ErrorDistributionChart />
        </div>

        {/* Analysis Row - Flakiest and Slowest Tests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FlakiestTestsCard />
          <SlowestTestsCard />
        </div>

        {/* Suite Analysis Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SuitePassRatesCard />
          <FlakinessBySuiteChart data={[]} />
        </div>

        {/* Filters and Executions */}
        <div className="space-y-4">
          <Filters branches={branches} suites={suites} />
          <ExecutionsView executions={executions} branchGroups={branchGroups} />
        </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
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
  searchParams: Promise<{ status?: string; branch?: string; suite?: string; from?: string; to?: string }>
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">Aestra</h1>
              <p className="text-sm sm:text-base text-muted-foreground text-pretty">Test Results, Illuminated by Intelligence</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <SearchTests />
              <AdminLink />
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <Suspense fallback={<DashboardSkeleton />}>

          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}
