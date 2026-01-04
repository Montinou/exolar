"use client"

import { useState, useEffect, useRef } from "react"
import {
  ChevronDown,
  GitBranch,
  Check,
  X,
  Calendar,
} from "lucide-react"
import type { TestExecution } from "@/lib/types"

interface ExecutionSelectorProps {
  label: string
  value: number | null
  onChange: (executionId: number | null) => void
  executions: TestExecution[]
  disabled?: boolean
}

export function ExecutionSelector({
  label,
  value,
  onChange,
  executions,
  disabled = false,
}: ExecutionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedExecution = executions.find((e) => e.id === value)

  // Group executions by branch
  const executionsByBranch = executions.reduce(
    (acc, exec) => {
      const branch = exec.branch
      if (!acc[branch]) acc[branch] = []
      acc[branch].push(exec)
      return acc
    },
    {} as Record<string, TestExecution[]>
  )

  // Filter by search term
  const filteredBranches = Object.entries(executionsByBranch).filter(([branch, execs]) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      branch.toLowerCase().includes(searchLower) ||
      execs.some(
        (e) =>
          e.commit_sha.toLowerCase().includes(searchLower) ||
          e.suite?.toLowerCase().includes(searchLower)
      )
    )
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="mb-2 block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50 ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        } ${isOpen ? "ring-2 ring-[oklch(0.75_0.15_195)]" : ""}`}
      >
        {selectedExecution ? (
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selectedExecution.branch}</p>
              <p className="truncate text-xs text-muted-foreground font-mono">
                {selectedExecution.commit_sha.slice(0, 7)}
                {selectedExecution.suite && ` • ${selectedExecution.suite}`}
                {" • "}
                {formatDate(selectedExecution.started_at)}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Select an execution...</span>
        )}
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="rounded p-1 hover:bg-muted/50"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
          {/* Search input */}
          <div className="border-b border-border p-2">
            <input
              type="text"
              placeholder="Search branches, commits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md bg-muted/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[oklch(0.75_0.15_195)]"
              autoFocus
            />
          </div>

          {/* Execution list */}
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredBranches.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No executions found
              </p>
            ) : (
              filteredBranches.map(([branch, branchExecutions]) => (
                <div key={branch} className="mb-2">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {branch}
                    </span>
                  </div>
                  {branchExecutions.slice(0, 5).map((exec) => (
                    <button
                      key={exec.id}
                      type="button"
                      onClick={() => {
                        onChange(exec.id)
                        setIsOpen(false)
                        setSearch("")
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50 ${
                        exec.id === value ? "bg-muted/30" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            exec.status === "success"
                              ? "bg-green-500"
                              : exec.status === "failure"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {exec.commit_sha.slice(0, 7)}
                            </span>
                            {exec.suite && (
                              <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs">
                                {exec.suite}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(exec.started_at)}
                            <span className="mx-1">•</span>
                            <span>
                              {exec.passed}/{exec.total_tests} passed
                            </span>
                          </div>
                        </div>
                      </div>
                      {exec.id === value && (
                        <Check className="h-4 w-4 text-[oklch(0.75_0.15_195)]" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
