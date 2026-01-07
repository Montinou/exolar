"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, FileCode, RefreshCw } from "lucide-react"
import { FlakyBadge } from "./flaky-badge"

interface TestFlakinessHistory {
  test_signature: string
  test_name: string
  test_file: string
  total_runs: number
  flaky_runs: number
  flakiness_rate: number
  last_flaky_at: string | null
}

interface FlakinessSummary {
  total_flaky_tests: number
  avg_flakiness_rate: number
}

interface FlakinessData {
  summary: FlakinessSummary
  tests: TestFlakinessHistory[]
}

export function FlakiestTestsCard({
  branch,
  suite,
  since,
  lastRunOnly,
}: {
  branch?: string
  suite?: string
  since?: string
  lastRunOnly?: boolean
}) {
  const [data, setData] = useState<FlakinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true) // Reset loading on filter change
      try {
        const params = new URLSearchParams({ limit: "5" })
        if (branch) params.append("branch", branch)
        if (suite) params.append("suite", suite)
        if (since) params.append("since", since)
        if (lastRunOnly) params.append("lastRunOnly", "true")

        const response = await fetch(`/api/flakiness?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Failed to fetch flakiness data")
        }
        const json = await response.json()
        setData(json)
      } catch (err) {
        console.error("Failed to fetch flakiness data:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [branch, suite, since, lastRunOnly])

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Flakiest Tests</h3>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/30 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Flakiest Tests</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
          <p className="text-sm">Failed to load flakiness data</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    )
  }

  const tests = data?.tests || []
  if (!data || tests.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Flakiest Tests</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No flaky tests detected</p>
          <p className="text-xs">Great job keeping tests stable!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Flakiest Tests</h3>
        </div>
        <Badge variant="secondary" className="bg-[var(--status-warning-light)] text-[var(--status-warning)]">
          {data.summary.total_flaky_tests} flaky
        </Badge>
      </div>
      <div className="space-y-2">
        {tests.map((test) => (
          <div
            key={test.test_signature}
            className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors status-border-warning"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{test.test_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <FileCode className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{test.test_file}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <FlakyBadge
                flakinessRate={test.flakiness_rate}
                flakyRuns={test.flaky_runs}
                totalRuns={test.total_runs}
              />
              <span className="text-xs text-muted-foreground">
                {test.flaky_runs}/{test.total_runs} runs
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
