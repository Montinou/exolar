import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg, type DateRangeFilter } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { ErrorDistributionChart } from "@/components/dashboard/error-distribution-chart"
import { FailureRateChart } from "@/components/dashboard/failure-rate-chart"
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

  return (
    <>
      <div className="space-y-6">
        <StatsCards metrics={metrics} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorDistributionChart />
          <FailureRateChart dateFrom={params.from} dateTo={params.to} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FlakiestTestsCard />
          <SlowestTestsCard />
        </div>
        <SuitePassRatesCard />
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-[400px] w-full" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
      <Skeleton className="h-[500px] w-full" />
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
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-balance">Aestra</h1>
              <p className="text-muted-foreground text-pretty">Test Results, Illuminated by Intelligence</p>
            </div>
            <div className="flex items-center gap-4">
              <SearchTests />
              <AdminLink />
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<DashboardSkeleton />}>

          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}
