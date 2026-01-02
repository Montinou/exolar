"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export function FlakiestTestsCard() {
  const [data, setData] = useState<FlakinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/flakiness?limit=5")
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
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
            <p className="text-sm">Failed to load flakiness data</p>
            <p className="text-xs">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const tests = data?.tests || []
  if (!data || tests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No flaky tests detected</p>
            <p className="text-xs">Great job keeping tests stable!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </span>
          <Badge variant="secondary">{data.summary.total_flaky_tests} flaky</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.test_signature}
              className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{test.test_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
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
      </CardContent>
    </Card>
  )
}
