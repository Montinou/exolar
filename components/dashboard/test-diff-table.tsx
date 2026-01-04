"use client"

import { useState } from "react"
import {
  ArrowRight,
  Filter,
  ArrowUpDown,
  FileCode,
} from "lucide-react"
import type { TestComparisonItem, TestDiffCategory } from "@/lib/types"
import { DiffCategoryBadge } from "./diff-category-badge"

const STATUS_COLORS: Record<string, string> = {
  passed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  skipped: "bg-yellow-500/20 text-yellow-400",
}

interface TestDiffTableProps {
  tests: TestComparisonItem[]
  onTestClick?: (test: TestComparisonItem) => void
}

type SortField = "name" | "duration" | "category"
type SortDirection = "asc" | "desc"

const FILTER_OPTIONS: Array<{ value: TestDiffCategory | "all"; label: string; count?: number }> = [
  { value: "all", label: "All Changes" },
  { value: "new_failure", label: "New Failures" },
  { value: "fixed", label: "Fixed" },
  { value: "new_test", label: "New Tests" },
  { value: "removed_test", label: "Removed" },
]

export function TestDiffTable({ tests, onTestClick }: TestDiffTableProps) {
  const [filter, setFilter] = useState<TestDiffCategory | "all">("all")
  const [sortField, setSortField] = useState<SortField>("category")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Calculate counts for each category
  const categoryCounts = tests.reduce(
    (acc, t) => {
      acc[t.diffCategory] = (acc[t.diffCategory] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Filter tests (exclude unchanged by default in "all" view)
  const filteredTests = tests.filter((t) => {
    if (filter === "all") return t.diffCategory !== "unchanged"
    return t.diffCategory === filter
  })

  // Sort tests
  const sortedTests = [...filteredTests].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case "name":
        comparison = a.testName.localeCompare(b.testName)
        break
      case "duration":
        comparison = (a.durationDeltaPercent || 0) - (b.durationDeltaPercent || 0)
        break
      case "category":
        const order: Record<TestDiffCategory, number> = {
          new_failure: 0,
          fixed: 1,
          new_test: 2,
          removed_test: 3,
          unchanged: 4,
        }
        comparison = order[a.diffCategory] - order[b.diffCategory]
        break
    }
    return sortDirection === "asc" ? comparison : -comparison
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const totalChanges =
    (categoryCounts.new_failure || 0) +
    (categoryCounts.fixed || 0) +
    (categoryCounts.new_test || 0) +
    (categoryCounts.removed_test || 0)

  return (
    <div className="glass-card overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-border/50 p-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const count =
              option.value === "all" ? totalChanges : categoryCounts[option.value] || 0
            if (option.value !== "all" && count === 0) return null
            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === option.value
                    ? "bg-[oklch(0.75_0.15_195)] text-white"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {option.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="p-4">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Test Name
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-4 text-center">Baseline</th>
              <th className="p-4 text-center w-8" />
              <th className="p-4 text-center">Current</th>
              <th className="p-4">
                <button
                  onClick={() => handleSort("duration")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Duration
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-4">
                <button
                  onClick={() => handleSort("category")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Change
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTests.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {filter === "all"
                    ? "No changes detected between these executions"
                    : `No ${filter.replace("_", " ")} tests found`}
                </td>
              </tr>
            ) : (
              sortedTests.map((test) => (
                <tr
                  key={test.testSignature}
                  onClick={() => onTestClick?.(test)}
                  className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${
                    onTestClick ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="p-4">
                    <div className="flex items-start gap-2 min-w-0">
                      <FileCode className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{test.testName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {test.testFile}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {test.baselineStatus ? (
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[test.baselineStatus] || "bg-muted/30"
                        }`}
                      >
                        {test.baselineStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </td>
                  <td className="p-4 text-center">
                    {test.currentStatus ? (
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[test.currentStatus] || "bg-muted/30"
                        }`}
                      >
                        {test.currentStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    {test.durationDeltaPercent !== null ? (
                      <span
                        className={`text-sm ${
                          test.durationDeltaPercent > 20
                            ? "text-red-400"
                            : test.durationDeltaPercent < -20
                              ? "text-green-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {test.durationDeltaPercent > 0 ? "+" : ""}
                        {test.durationDeltaPercent}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <DiffCategoryBadge category={test.diffCategory} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {sortedTests.length > 0 && (
        <div className="border-t border-border/50 p-3 text-center text-xs text-muted-foreground">
          Showing {sortedTests.length} of {tests.length} tests
          {tests.filter((t) => t.diffCategory === "unchanged").length > 0 && (
            <span>
              {" "}
              ({tests.filter((t) => t.diffCategory === "unchanged").length} unchanged tests
              hidden)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
