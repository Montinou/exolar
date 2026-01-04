"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  GitCompare,
  ArrowLeftRight,
  Loader2,
  AlertCircle,
} from "lucide-react"
import type { TestExecution, ComparisonResult } from "@/lib/types"
import { ExecutionSelector } from "@/components/dashboard/execution-selector"
import { ComparisonSummaryCards } from "@/components/dashboard/comparison-summary-cards"
import { TestDiffTable } from "@/components/dashboard/test-diff-table"

interface CompareClientProps {
  executions: TestExecution[]
  branches: string[]
  suites: string[]
  initialBaseline: number | null
  initialCurrent: number | null
  initialBaselineBranch?: string
  initialCurrentBranch?: string
  initialSuite?: string
}

export function CompareClient({
  executions,
  branches,
  suites,
  initialBaseline,
  initialCurrent,
  initialBaselineBranch,
  initialCurrentBranch,
  initialSuite,
}: CompareClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [baselineId, setBaselineId] = useState<number | null>(initialBaseline)
  const [currentId, setCurrentId] = useState<number | null>(initialCurrent)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update URL when selection changes
  const updateUrl = useCallback(
    (baseline: number | null, current: number | null) => {
      const params = new URLSearchParams()
      if (baseline) params.set("baseline", baseline.toString())
      if (current) params.set("current", current.toString())
      router.push(`/dashboard/compare?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  // Fetch comparison when both IDs are selected
  const fetchComparison = useCallback(async () => {
    if (!baselineId || !currentId) {
      setComparison(null)
      return
    }

    if (baselineId === currentId) {
      setError("Cannot compare an execution with itself")
      setComparison(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/compare?baseline=${baselineId}&current=${currentId}`
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to compare executions")
      }

      setComparison(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setComparison(null)
    } finally {
      setLoading(false)
    }
  }, [baselineId, currentId])

  // Fetch comparison when IDs change
  useEffect(() => {
    fetchComparison()
  }, [fetchComparison])

  // Handle baseline selection
  const handleBaselineChange = (id: number | null) => {
    setBaselineId(id)
    updateUrl(id, currentId)
  }

  // Handle current selection
  const handleCurrentChange = (id: number | null) => {
    setCurrentId(id)
    updateUrl(baselineId, id)
  }

  // Swap baseline and current
  const handleSwap = () => {
    const newBaseline = currentId
    const newCurrent = baselineId
    setBaselineId(newBaseline)
    setCurrentId(newCurrent)
    updateUrl(newBaseline, newCurrent)
  }

  return (
    <div className="space-y-6">
      {/* Selection Section */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_auto_1fr]">
        {/* Baseline Selector */}
        <ExecutionSelector
          label="Baseline (Before)"
          value={baselineId}
          onChange={handleBaselineChange}
          executions={executions}
        />

        {/* Swap Button */}
        <div className="hidden items-center justify-center lg:flex">
          <button
            onClick={handleSwap}
            disabled={!baselineId || !currentId}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title="Swap baseline and current"
          >
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>

        {/* Current Selector */}
        <ExecutionSelector
          label="Current (After)"
          value={currentId}
          onChange={handleCurrentChange}
          executions={executions}
        />
      </div>

      {/* Mobile Swap Button */}
      <div className="flex justify-center lg:hidden">
        <button
          onClick={handleSwap}
          disabled={!baselineId || !currentId}
          className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Swap
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.75_0.15_195)]" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !comparison && (
        <div className="glass-card p-12 text-center">
          <GitCompare className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Select Two Executions</h3>
          <p className="mt-2 text-muted-foreground">
            Choose a baseline and current execution to compare their test results.
          </p>
        </div>
      )}

      {/* Comparison Results */}
      {!loading && !error && comparison && (
        <>
          {/* Execution Info Header */}
          <div className="glass-card p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div className="text-center md:text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Baseline
                </p>
                <p className="mt-1 font-mono text-sm">
                  {comparison.baseline.branch} •{" "}
                  {comparison.baseline.commitSha.slice(0, 7)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(comparison.baseline.startedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current
                </p>
                <p className="mt-1 font-mono text-sm">
                  {comparison.current.branch} •{" "}
                  {comparison.current.commitSha.slice(0, 7)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(comparison.current.startedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <ComparisonSummaryCards summary={comparison.summary} />

          {/* Test Diff Table */}
          <TestDiffTable tests={comparison.tests} />
        </>
      )}
    </div>
  )
}
