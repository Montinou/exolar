"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  ChevronDown,
  GitBranch,
  Check,
  X,
  Calendar,
  Loader2,
  Search,
  AlertCircle,
} from "lucide-react"
import type { TestExecution } from "@/lib/types"

interface ExecutionSelectorProps {
  label: string
  value: number | null
  onChange: (executionId: number | null) => void
  executions: TestExecution[]
  disabled?: boolean
}

/**
 * Custom hook for debounced server-side search with request cancellation.
 * Returns search results, loading state, and error state.
 */
function useExecutionSearch(searchQuery: string, minLength = 2, debounceMs = 300) {
  const [results, setResults] = useState<TestExecution[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset if query too short
    if (searchQuery.length < minLength) {
      setResults([])
      setIsSearching(false)
      setError(null)
      return
    }

    // Set debouncing state immediately
    setIsSearching(true)
    setError(null)

    const timeoutId = setTimeout(async () => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()
      
      try {
        const response = await fetch(
          `/api/executions/search?q=${encodeURIComponent(searchQuery)}&limit=30`,
          { signal: abortControllerRef.current.signal }
        )
        
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }
        
        const data = await response.json()
        setResults(data.executions || [])
        setError(null)
      } catch (err) {
        // Ignore abort errors (expected when cancelling)
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        console.error("Search error:", err)
        setError("Search failed. Please try again.")
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)

    // Cleanup: clear timeout and cancel request
    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [searchQuery, minLength, debounceMs])

  return { results, isSearching, error }
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
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Server-side search hook
  const { results: searchResults, isSearching, error: searchError } = useExecutionSearch(search)

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const selectedExecution = useMemo(
    () => executions.find((e) => e.id === value),
    [executions, value]
  )

  // Merge local executions with search results (deduplicate by id)
  const allExecutions = useMemo(() => {
    const executionMap = new Map<number, TestExecution>()
    
    // Add local executions first
    executions.forEach((e) => executionMap.set(e.id, e))
    
    // Add search results (may include executions not in local list)
    searchResults.forEach((e) => executionMap.set(e.id, e))
    
    return Array.from(executionMap.values())
  }, [executions, searchResults])

  // Group executions by branch (memoized for performance)
  const executionsByBranch = useMemo(() => {
    const grouped = allExecutions.reduce(
      (acc, exec) => {
        const branch = exec.branch
        if (!acc[branch]) acc[branch] = []
        acc[branch].push(exec)
        return acc
      },
      {} as Record<string, TestExecution[]>
    )
    
    // Sort executions within each branch by date (most recent first)
    Object.values(grouped).forEach((execs) => {
      execs.sort((a, b) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )
    })
    
    return grouped
  }, [allExecutions])

  // Filter branches by search term (instant client-side filter for better UX)
  const filteredBranches = useMemo(() => {
    if (!search) return Object.entries(executionsByBranch)
    
    const searchLower = search.toLowerCase()
    return Object.entries(executionsByBranch).filter(([branch, execs]) => 
      branch.toLowerCase().includes(searchLower) ||
      execs.some(
        (e) =>
          e.commit_sha.toLowerCase().includes(searchLower) ||
          e.suite?.toLowerCase().includes(searchLower)
      )
    )
  }, [executionsByBranch, search])

  // Toggle expanded state for a branch
  const toggleBranchExpand = useCallback((branch: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev)
      if (next.has(branch)) {
        next.delete(branch)
      } else {
        next.add(branch)
      }
      return next
    })
  }, [])

  // Determine how many executions to show per branch
  const getVisibleExecutions = useCallback((branch: string, execs: TestExecution[]) => {
    const isExpanded = expandedBranches.has(branch)
    return isExpanded ? execs : execs.slice(0, 5)
  }, [expandedBranches])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleSelect = useCallback((execId: number) => {
    onChange(execId)
    setIsOpen(false)
    setSearch("")
  }, [onChange])

  const isLoading = isSearching

  return (
    <div className="relative" ref={dropdownRef}>
      <label 
        id={`${label}-label`}
        className="mb-2 block text-sm font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            setIsOpen(!isOpen)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${label}-label`}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer ${
          disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : ""
        } ${isOpen ? "ring-2 ring-[oklch(0.75_0.15_195)]" : ""}`}
      >
        {selectedExecution ? (
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {selectedExecution.branch}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedExecution.commit_sha.slice(0, 7)} • {formatDate(selectedExecution.started_at)}
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
              aria-label="Clear selection"
              className="rounded p-1 hover:bg-muted/50"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg"
          role="listbox"
          aria-labelledby={`${label}-label`}
        >
          {/* Search input with loading indicator */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search branches, commits..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search executions"
                className="w-full rounded-md bg-muted/30 pl-9 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[oklch(0.75_0.15_195)]"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
            </div>
            {search.length > 0 && search.length < 2 && (
              <p className="mt-1 text-xs text-muted-foreground" role="status">
                Type at least 2 characters to search
              </p>
            )}
          </div>

          {/* Error state */}
          {searchError && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span role="alert">{searchError}</span>
            </div>
          )}

          {/* Execution list with expandable branches */}
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredBranches.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground" role="status">
                {isLoading ? "Searching..." : "No executions found"}
              </p>
            ) : (
              filteredBranches.map(([branch, branchExecutions]) => {
                const visible = getVisibleExecutions(branch, branchExecutions)
                const hasMore = branchExecutions.length > visible.length
                const hiddenCount = branchExecutions.length - 5
                
                return (
                  <div key={branch} className="mb-2">
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {branch}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {branchExecutions.length} runs
                      </span>
                    </div>
                    {visible.map((exec) => (
                      <button
                        key={exec.id}
                        type="button"
                        role="option"
                        aria-selected={exec.id === value}
                        onClick={() => handleSelect(exec.id)}
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
                            aria-label={`Status: ${exec.status}`}
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
                              <Calendar className="h-3 w-3" aria-hidden="true" />
                              <span>{formatDate(exec.started_at)}</span>
                              <span className="mx-1">•</span>
                              <span>
                                {exec.passed}/{exec.total_tests} passed
                              </span>
                            </div>
                          </div>
                        </div>
                        {exec.id === value && (
                          <Check className="h-4 w-4 text-[oklch(0.75_0.15_195)]" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => toggleBranchExpand(branch)}
                        className="w-full px-3 py-1.5 text-xs text-[oklch(0.75_0.15_195)] hover:underline"
                        aria-expanded={expandedBranches.has(branch)}
                      >
                        {expandedBranches.has(branch)
                          ? "Show less"
                          : `Load ${hiddenCount} more...`}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
