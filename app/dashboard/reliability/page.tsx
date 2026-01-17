import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Filters } from "@/components/dashboard/filters"
import { ReliabilityScoreCard } from "@/components/dashboard/reliability-score"
import { FlakiestTestsCard } from "@/components/dashboard/flakiest-tests-card"
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Timer,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"
import type { ReliabilityScore } from "@/lib/types"

export const dynamic = "force-dynamic"

async function ReliabilityContent({
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

  const [score, branchStats, suiteStats] = await Promise.all([
    db.getReliabilityScore({
      from: params.from,
      to: params.to,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "var(--status-success)"
      case "warning":
        return "var(--status-warning)"
      case "critical":
        return "var(--status-error)"
      default:
        return "var(--exolar-cyan)"
    }
  }

  const TrendIcon =
    score.trend > 0 ? TrendingUp : score.trend < 0 ? TrendingDown : Minus
  const trendColor =
    score.trend > 0
      ? "text-[var(--status-success)]"
      : score.trend < 0
        ? "text-[var(--status-error)]"
        : "text-muted-foreground"

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Filters
        branches={branches}
        suites={suites}
        showStatus={false}
        basePath="/dashboard/reliability"
      />

      {/* Hero Section - Score Card */}
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <ReliabilityScoreCard
            initialScore={score}
            branch={params.branch}
            suite={params.suite}
            from={params.from}
            to={params.to}
            lastRunOnly={lastRunOnly}
          />
        </div>
      </div>

      {/* Score Breakdown */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
          Score Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pass Rate Contribution */}
          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                Pass Rate Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--status-success)]">
                +{score.breakdown.passRateContribution}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {score.rawMetrics.passRate}% pass rate × 40% weight
              </p>
            </CardContent>
          </Card>

          {/* Flakiness Contribution */}
          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />
                Flakiness Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--status-warning)]">
                +{score.breakdown.flakinessContribution}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {100 - score.rawMetrics.flakyRate}% stable × 30% weight
              </p>
            </CardContent>
          </Card>

          {/* Stability Contribution */}
          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4 text-[var(--exolar-cyan)]" />
                Duration Stability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--exolar-cyan)]">
                +{score.breakdown.stabilityContribution}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {Math.round((1 - Math.min(score.rawMetrics.durationCV, 1)) * 100)}% consistent × 30% weight
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Raw Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
          Raw Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-3xl font-bold"
                style={{ color: getStatusColor(score.status) }}
              >
                {score.score}
              </div>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {score.status}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pass Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--status-success)]">
                {score.rawMetrics.passRate}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Tests passing
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Flaky Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--status-warning)]">
                {score.rawMetrics.flakyRate}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Tests flaky
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Week-over-Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold flex items-center gap-2 ${trendColor}`}>
                <TrendIcon className="h-6 w-6" />
                {score.trend > 0 ? "+" : ""}
                {score.trend}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                vs previous period
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Flakiest Tests and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FlakiestTestsCard
          branch={params.branch}
          suite={params.suite}
          since={params.from}
          lastRunOnly={lastRunOnly}
        />
      </div>

      {/* Formula Explanation */}
      <Card className="glass-card glass-card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--exolar-cyan)]" />
            How the Score is Calculated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-sm bg-muted/20 p-4 rounded-lg">
            <span className="text-[var(--status-success)]">Pass Rate × 0.4</span>
            {" + "}
            <span className="text-[var(--status-warning)]">(100 - Flaky Rate) × 0.3</span>
            {" + "}
            <span className="text-[var(--exolar-cyan)]">Duration Stability × 0.3</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            The reliability score weighs test pass rate most heavily (40%), with flakiness
            and duration stability each contributing 30%. A score of 80+ indicates healthy
            test suite, 60-79 suggests improvements needed, and below 60 requires attention.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ReliabilitySkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Skeleton */}
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <div className="glass-card glass-card-glow p-6">
            <Skeleton className="h-48 w-full bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Breakdown Skeleton */}
      <div>
        <Skeleton className="h-6 w-40 mb-4 bg-muted/30" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card glass-card-glow p-6">
              <Skeleton className="h-24 w-full bg-muted/30" />
            </div>
          ))}
        </div>
      </div>

      {/* Raw Metrics Skeleton */}
      <div>
        <Skeleton className="h-6 w-32 mb-4 bg-muted/30" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card glass-card-glow p-6">
              <Skeleton className="h-20 w-full bg-muted/30" />
            </div>
          ))}
        </div>
      </div>

      {/* Formula Skeleton */}
      <div className="glass-card glass-card-glow p-6">
        <Skeleton className="h-32 w-full bg-muted/30" />
      </div>
    </div>
  )
}

export default async function ReliabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string; suite?: string; historic?: string }>
}) {
  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <Suspense fallback={<ReliabilitySkeleton />}>
        {/* @ts-expect-error Async Server Component */}
        <ReliabilityContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
