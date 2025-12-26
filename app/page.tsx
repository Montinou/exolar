import { Suspense } from "react"
import { getDashboardMetrics, getTrendData, getExecutions, getBranches } from "@/lib/db"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { ExecutionsTable } from "@/components/dashboard/executions-table"
import { Filters } from "@/components/dashboard/filters"
import { UserMenu } from "@/components/dashboard/user-menu"
import { SearchTests } from "@/components/dashboard/search-tests"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string }>
}) {
  const params = await searchParams
  const [metrics, trends, executions, branches] = await Promise.all([
    getDashboardMetrics(),
    getTrendData(7),
    getExecutions(50, params.status, params.branch),
    getBranches(),
  ])

  return (
    <>
      <div className="space-y-6">
        <StatsCards metrics={metrics} />
        <TrendChart data={trends} />
        <div className="space-y-4">
          <Filters branches={branches} />
          <ExecutionsTable executions={executions} />
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
      <Skeleton className="h-[400px] w-full" />
      <Skeleton className="h-[500px] w-full" />
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string }>
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-balance">E2E Test Dashboard</h1>
              <p className="text-muted-foreground text-pretty">Monitor Playwright test executions from GitHub Actions</p>
            </div>
            <div className="flex items-center gap-4">
              <SearchTests />
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
