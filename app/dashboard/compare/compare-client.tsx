"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  GitCompare,
  ArrowLeftRight,
  Loader2,
  AlertCircle,
  GitBranch,
  List,
} from "lucide-react"
import type { TestExecution, ComparisonResult } from "@/lib/types"
import type { BranchStatistics } from "@/lib/db"
import { ExecutionSelector } from "@/components/dashboard/execution-selector"
import { BranchSelector } from "@/components/dashboard/branch-selector"
import { ComparisonSummaryCards } from "@/components/dashboard/comparison-summary-cards"
import { PerformanceInsightsCard } from "@/components/dashboard/performance-insights-card"
import { TestDiffTable } from "@/components/dashboard/test-diff-table"

type CompareMode = "branch" | "execution"

interface CompareClientProps {
  executions: TestExecution[]
  branches: string[]
  branchStats: BranchStatistics[]
  suites: string[]
  initialBaseline: number | null
  initialCurrent: number | null
  initialBaselineBranch?: string
  initialCurrentBranch?: string
  initialSuite?: string
  initialMode?: CompareMode
}

export function CompareClient({
  executions,
  branches,
  branchStats,
  suites,
  initialBaseline,
  initialCurrent,
  initialBaselineBranch,
  initialCurrentBranch,
  initialSuite,
  initialMode = "branch",
}: CompareClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Mode state
  const [mode, setMode] = useState<CompareMode>(initialMode)

  // Execution mode state
  const [baselineId, setBaselineId] = useState<number | null>(initialBaseline)
  const [currentId, setCurrentId] = useState<number | null>(initialCurrent)

  // Branch mode state
  const [baselineBranch, setBaselineBranch] = useState<string | null>(
    initialBaselineBranch || null
  )
  const [currentBranch, setCurrentBranch] = useState<string | null>(
    initialCurrentBranch || null
  )
  const [selectedSuite, setSelectedSuite] = useState<string | null>(
    initialSuite || null
  )

  // Shared state
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update URL when selection changes
  const updateUrl = useCallback(
    (params: {
      baseline?: number | null
      current?: number | null
      baselineBranch?: string | null
      currentBranch?: string | null
      suite?: string | null
      mode?: CompareMode
    }) => {
      const urlParams = new URLSearchParams()
      
      if (params.mode) urlParams.set("mode", params.mode)
      
      if (params.mode === "execution") {
        if (params.baseline) urlParams.set("baseline", params.baseline.toString())
        if (params.current) urlParams.set("current", params.current.toString())
      } else {
        if (params.baselineBranch) urlParams.set("baseline_branch", params.baselineBranch)
        if (params.currentBranch) urlParams.set("current_branch", params.currentBranch)
        if (params.suite) urlParams.set("suite", params.suite)
      }
      
      router.push(`/dashboard/compare?${urlParams.toString()}`, { scroll: false })
    },
    [router]
  )

  // Fetch comparison based on mode
  const fetchComparison = useCallback(async () => {
    // Branch mode: need both branches
    if (mode === "branch") {
      if (!baselineBranch || !currentBranch) {
        setComparison(null)
        setError(null)
        return
      }
      
      if (baselineBranch === currentBranch) {
        setError("Cannot compare a branch with itself")
        setComparison(null)
        return
      }
    } else {
      // Execution mode: need both IDs
      if (!baselineId || !currentId) {
        setComparison(null)
        setError(null)
        return
      }
      
      if (baselineId === currentId) {
        setError("Cannot compare an execution with itself")
        setComparison(null)
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      // Build URL based on mode
      const params = new URLSearchParams()
      
      if (mode === "branch") {
        params.set("baseline_branch", baselineBranch!)
        params.set("current_branch", currentBranch!)
        if (selectedSuite) {
          params.set("suite", selectedSuite)
        }
      } else {
        params.set("baseline", baselineId!.toString())
        params.set("current", currentId!.toString())
      }

      const res = await fetch(`/api/compare?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to compare")
      }

      setComparison(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setComparison(null)
    } finally {
      setLoading(false)
    }
  }, [mode, baselineBranch, currentBranch, selectedSuite, baselineId, currentId])

  // Fetch comparison when dependencies change
  useEffect(() => {
    fetchComparison()
  }, [fetchComparison])

  // Handle mode switch
  const handleModeChange = useCallback((newMode: CompareMode) => {
    setMode(newMode)
    setComparison(null)
    setError(null)
    updateUrl({ mode: newMode })
  }, [updateUrl])

  // Handle branch selection
  const handleBaselineBranchChange = useCallback((branch: string | null) => {
    setBaselineBranch(branch)
    updateUrl({ 
      mode, 
      baselineBranch: branch, 
      currentBranch, 
      suite: selectedSuite 
    })
  }, [mode, currentBranch, selectedSuite, updateUrl])

  const handleCurrentBranchChange = useCallback((branch: string | null) => {
    setCurrentBranch(branch)
    updateUrl({ 
      mode, 
      baselineBranch, 
      currentBranch: branch, 
      suite: selectedSuite 
    })
  }, [mode, baselineBranch, selectedSuite, updateUrl])

  // Handle execution selection
  const handleBaselineChange = useCallback((id: number | null) => {
    setBaselineId(id)
    updateUrl({ mode, baseline: id, current: currentId })
  }, [mode, currentId, updateUrl])

  const handleCurrentChange = useCallback((id: number | null) => {
    setCurrentId(id)
    updateUrl({ mode, baseline: baselineId, current: id })
  }, [mode, baselineId, updateUrl])

  // Swap branches or executions
  const handleSwap = useCallback(() => {
    if (mode === "branch") {
      const temp = baselineBranch
      setBaselineBranch(currentBranch)
      setCurrentBranch(temp)
      updateUrl({ mode, baselineBranch: currentBranch, currentBranch: temp, suite: selectedSuite })
    } else {
      const temp = baselineId
      setBaselineId(currentId)
      setCurrentId(temp)
      updateUrl({ mode, baseline: currentId, current: temp })
    }
  }, [mode, baselineBranch, currentBranch, baselineId, currentId, selectedSuite, updateUrl])

  // Check if comparison can be made
  const canCompare = useMemo(() => {
    if (mode === "branch") {
      return baselineBranch && currentBranch && baselineBranch !== currentBranch
    }
    return baselineId && currentId && baselineId !== currentId
  }, [mode, baselineBranch, currentBranch, baselineId, currentId])

  return (
    <div className="space-y-6">
      {/* Mode Toggle Tabs */}
      <div 
        className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit"
        role="tablist"
        aria-label="Comparison mode"
      >
        <button
          role="tab"
          aria-selected={mode === "branch"}
          aria-controls="branch-mode-panel"
          onClick={() => handleModeChange("branch")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "branch"
              ? "bg-[oklch(0.75_0.15_195)] text-white"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <GitBranch className="h-4 w-4" aria-hidden="true" />
          Branch Mode
        </button>
        <button
          role="tab"
          aria-selected={mode === "execution"}
          aria-controls="execution-mode-panel"
          onClick={() => handleModeChange("execution")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "execution"
              ? "bg-[oklch(0.75_0.15_195)] text-white"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <List className="h-4 w-4" aria-hidden="true" />
          Execution Mode
        </button>
      </div>

      {/* Selection Section */}
      {mode === "branch" ? (
        <div 
          id="branch-mode-panel"
          role="tabpanel"
          aria-labelledby="branch-mode-tab"
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_auto_1fr]">
            {/* Baseline Branch Selector */}
            <BranchSelector
              label="Baseline Branch (Before)"
              value={baselineBranch}
              onChange={handleBaselineBranchChange}
              branches={branchStats}
            />

            {/* Swap Button */}
            <div className="hidden items-center justify-center lg:flex">
              <button
                onClick={handleSwap}
                disabled={!baselineBranch || !currentBranch}
                aria-label="Swap baseline and current branches"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeftRight className="h-5 w-5" />
              </button>
            </div>

            {/* Current Branch Selector */}
            <BranchSelector
              label="Current Branch (After)"
              value={currentBranch}
              onChange={handleCurrentBranchChange}
              branches={branchStats}
            />
          </div>

          {/* Suite Filter (optional) */}
          <div className="flex items-center gap-3">
            <label 
              htmlFor="suite-filter"
              className="text-sm text-muted-foreground"
            >
              Filter by suite:
            </label>
            <select
              id="suite-filter"
              value={selectedSuite || ""}
              onChange={(e) => {
                const value = e.target.value || null
                setSelectedSuite(value)
                updateUrl({ mode, baselineBranch, currentBranch, suite: value })
              }}
              className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[oklch(0.75_0.15_195)]"
            >
              <option value="">All Suites</option>
              {suites.map((suite) => (
                <option key={suite} value={suite}>
                  {suite}
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Info */}
          {baselineBranch && currentBranch && (
            <div className="glass-card p-3 text-sm text-muted-foreground" role="status">
              <p>
                Comparing <span className="font-medium text-foreground">{baselineBranch}</span>&apos;s 
                latest run with <span className="font-medium text-foreground">{currentBranch}</span>&apos;s 
                latest run
                {selectedSuite && (
                  <> (filtered to <span className="font-medium">{selectedSuite}</span> suite)</>
                )}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Execution Mode - existing selectors */
        <div 
          id="execution-mode-panel"
          role="tabpanel"
          aria-labelledby="execution-mode-tab"
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_auto_1fr]">
            <ExecutionSelector
              label="Baseline (Before)"
              value={baselineId}
              onChange={handleBaselineChange}
              executions={executions}
            />
            <div className="hidden items-center justify-center lg:flex">
              <button
                onClick={handleSwap}
                disabled={!baselineId || !currentId}
                aria-label="Swap baseline and current executions"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeftRight className="h-5 w-5" />
              </button>
            </div>
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
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.75_0.15_195)]" aria-hidden="true" />
          <span className="sr-only">Loading comparison...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="glass-card p-6" role="alert">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !comparison && (
        <div className="glass-card p-12 text-center">
          <GitCompare className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-medium">
            {mode === "branch" ? "Select Two Branches" : "Select Two Executions"}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {mode === "branch"
              ? "Choose baseline and current branches to compare their latest test results."
              : "Choose a baseline and current execution to compare their test results."}
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
                  <span className="text-muted-foreground">
                    {comparison.baseline.commitSha.slice(0, 7)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(comparison.baseline.startedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current
                </p>
                <p className="mt-1 font-mono text-sm">
                  {comparison.current.branch} •{" "}
                  <span className="text-muted-foreground">
                    {comparison.current.commitSha.slice(0, 7)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(comparison.current.startedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <ComparisonSummaryCards summary={comparison.summary} />

          {/* Performance Insights */}
          {comparison.performanceSummary && (
            <PerformanceInsightsCard
              tests={comparison.tests}
              performanceSummary={comparison.performanceSummary}
            />
          )}

          {/* Test Diff Table */}
          <TestDiffTable tests={comparison.tests} />
        </>
      )}
    </div>
  )
}
