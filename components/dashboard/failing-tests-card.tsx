"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FailingTest {
  testSignature: string
  testFile: string
  testTitle: string
  totalFailures: number
  totalRuns: number
  failureRate: number
  firstFailure: string | null
  lastFailure: string | null
}

interface FailingTestsCardProps {
  days?: number
  limit?: number
}

export function FailingTestsCard({ days = 30, limit = 10 }: FailingTestsCardProps) {
  const [tests, setTests] = useState<FailingTest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/tests/failing?days=${days}&limit=${limit}`)
        const json = await response.json()
        setTests(json.tests || [])
      } catch (error) {
        console.error("Failed to fetch failing tests:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [days, limit])

  if (loading) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Most Failing Tests
          </h3>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (tests.length === 0) {
    return (
      <div className="glass-card glass-card-glow p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Most Failing Tests
          </h3>
        </div>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No failing tests tracked</p>
            <p className="text-xs">Run migration to populate stats</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card glass-card-glow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Most Failing Tests
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          Last {days} days
        </span>
      </div>

      <div className="space-y-3">
        {tests.map((test, index) => (
          <div
            key={test.testSignature}
            className="p-3 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    #{index + 1}
                  </span>
                  <p className="text-sm font-medium text-foreground/90 truncate">
                    {test.testTitle}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {test.testFile}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                  variant="destructive"
                  className="text-xs"
                >
                  {test.totalFailures} failures
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {Math.round(test.failureRate * 100)}% fail rate
                </span>
                <span className="text-xs text-muted-foreground">
                  of {test.totalRuns} runs
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
