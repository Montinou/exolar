import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { Skeleton } from "@/components/ui/skeleton"
import { BrandLogo } from "@/components/ui/brand-logo"
import { UserMenu } from "@/components/dashboard/user-menu"
import { AdminLink } from "@/components/dashboard/admin-link"
import { SearchTests } from "@/components/dashboard/search-tests"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { CompareClient } from "./compare-client"
import type { TestExecution } from "@/lib/types"

export const dynamic = "force-dynamic"

interface CompareContentProps {
  searchParams: Promise<{
    baseline?: string
    current?: string
    baseline_branch?: string
    current_branch?: string
    suite?: string
    mode?: string
  }>
}

async function CompareContent({ searchParams }: CompareContentProps) {
  const context = await getSessionContext()
  if (!context) {
    redirect("/auth/signin")
  }

  const db = getQueriesForOrg(context.organizationId)
  const params = await searchParams

  // Fetch executions for the selector (recent 50)
  const [executions, branchStats, suiteStats] = await Promise.all([
    db.getExecutions(50),
    db.getBranches(),
    db.getSuites(),
  ])

  // Extract names for dropdowns
  const branches = branchStats.map((b) => b.branch)
  const suites = suiteStats.map((s) => s.suite)

  // Parse initial execution IDs from URL
  const initialBaseline = params.baseline ? parseInt(params.baseline, 10) : null
  const initialCurrent = params.current ? parseInt(params.current, 10) : null

  // Determine initial mode from URL params
  // If explicit execution IDs provided, use execution mode for backwards compat
  // If branch params provided, use branch mode
  // Otherwise default to branch mode
  let initialMode: "branch" | "execution" = "branch"
  if (params.mode === "execution" || (initialBaseline !== null && initialCurrent !== null)) {
    initialMode = "execution"
  } else if (params.mode === "branch" || params.baseline_branch || params.current_branch) {
    initialMode = "branch"
  }

  return (
    <CompareClient
      executions={executions}
      branches={branches}
      branchStats={branchStats}
      suites={suites}
      initialBaseline={initialBaseline}
      initialCurrent={initialCurrent}
      initialBaselineBranch={params.baseline_branch}
      initialCurrentBranch={params.current_branch}
      initialSuite={params.suite}
      initialMode={initialMode}
    />
  )
}

function CompareSkeleton() {
  return (
    <div className="space-y-6">
      {/* Selectors Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_auto_1fr]">
        <div className="glass-card p-4">
          <Skeleton className="mb-2 h-4 w-20 bg-muted/30" />
          <Skeleton className="h-12 w-full bg-muted/30" />
        </div>
        <div className="hidden items-center justify-center lg:flex">
          <Skeleton className="h-8 w-8 rounded-full bg-muted/30" />
        </div>
        <div className="glass-card p-4">
          <Skeleton className="mb-2 h-4 w-20 bg-muted/30" />
          <Skeleton className="h-12 w-full bg-muted/30" />
        </div>
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4">
            <Skeleton className="h-20 w-full bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="glass-card">
        <div className="border-b border-border/50 p-4">
          <Skeleton className="h-8 w-64 bg-muted/30" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-muted/30" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    baseline?: string
    current?: string
    baseline_branch?: string
    current_branch?: string
    suite?: string
  }>
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-2">
                <BrandLogo variant="animated-icon" width={32} />
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  style={{
                    background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Compare Runs
                </h1>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground text-pretty">
                Side-by-side comparison of test executions
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <SearchTests />
              <AdminLink />
              <UserMenu />
            </div>
          </div>

          {/* Dashboard Navigation */}
          <div className="mt-4">
            <DashboardNav />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <Suspense fallback={<CompareSkeleton />}>
          {/* @ts-expect-error Async Server Component */}
          <CompareContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}
