"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Clock, FileCode, Loader2 } from "lucide-react"

interface SlowestTest {
  test_signature: string
  test_name: string
  test_file: string
  avg_duration_ms: number
  run_count: number
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export function SlowestTestsCard() {
  const [tests, setTests] = useState<SlowestTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/slowest-tests?limit=5")
        if (!response.ok) {
          throw new Error("Failed to fetch slowest tests")
        }
        const json = await response.json()
        setTests(json.tests || [])
      } catch (err) {
        console.error("Failed to fetch slowest tests:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Slowest Tests</h3>
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
          <Clock className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Slowest Tests</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
          <p className="text-sm">Failed to load data</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    )
  }

  if (!Array.isArray(tests) || tests.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Slowest Tests</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No test data available</p>
          <p className="text-xs">Need at least 3 runs per test</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--exolar-cyan)]" />
          <h3 className="text-sm font-medium text-muted-foreground">Slowest Tests</h3>
        </div>
        <Badge variant="secondary">Last 7 days</Badge>
      </div>
      <div className="space-y-2">
        {tests.map((test) => (
          <div
            key={test.test_signature}
            className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors status-border-info"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{test.test_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <FileCode className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{test.test_file}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Badge variant="outline" className="font-mono stat-value-cyan border-[var(--exolar-cyan)]/30">
                {formatDuration(test.avg_duration_ms)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {test.run_count} runs
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
