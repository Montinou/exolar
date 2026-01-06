"use client"

import { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent } from "react"
import {
  ChevronDown,
  GitBranch,
  Check,
  X,
  Clock,
  Hash,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { BranchStatistics } from "@/lib/db"

interface BranchSelectorProps {
  /** Label for the selector (e.g., "Baseline Branch") */
  label: string
  /** Currently selected branch name, or null if none selected */
  value: string | null
  /** Callback when selection changes */
  onChange: (branch: string | null) => void
  /** Array of branches with their statistics */
  branches: BranchStatistics[]
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Show "Quick compare with main" button */
  showQuickCompare?: boolean
  /** Callback for quick compare action */
  onQuickCompareWithMain?: () => void
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-500",
  failure: "bg-red-500",
  running: "bg-yellow-500",
}

/**
 * Get appropriate color classes for pass rate badge
 */
function getPassRateColor(passRate: number): string {
  if (passRate >= 80) return "text-green-400 bg-green-500/10"
  if (passRate >= 50) return "text-yellow-400 bg-yellow-500/10"
  return "text-red-400 bg-red-500/10"
}

/**
 * Format last run time as human-readable relative time
 */
function formatLastRun(lastRun: string | null): string {
  if (!lastRun) return "No runs"
  try {
    return formatDistanceToNow(new Date(lastRun), { addSuffix: true })
  } catch {
    return "Unknown"
  }
}

export function BranchSelector({
  label,
  value,
  onChange,
  branches,
  disabled = false,
  showQuickCompare = false,
  onQuickCompareWithMain,
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      setHighlightedIndex(-1)
    }
  }, [isOpen])

  // Get the selected branch's statistics
  const selectedBranch = useMemo(
    () => branches.find((b) => b.branch === value),
    [branches, value]
  )

  // Filter branches by search term (memoized)
  const filteredBranches = useMemo(() => {
    if (!search) return branches
    const searchLower = search.toLowerCase()
    return branches.filter((b) => 
      b.branch.toLowerCase().includes(searchLower)
    )
  }, [branches, search])

  // Sort: "main" or "master" first, then by last_run (memoized)
  const sortedBranches = useMemo(() => {
    return [...filteredBranches].sort((a, b) => {
      const isAMain = a.branch === "main" || a.branch === "master"
      const isBMain = b.branch === "main" || b.branch === "master"
      if (isAMain && !isBMain) return -1
      if (!isAMain && isBMain) return 1
      
      // Then sort by last_run (most recent first)
      if (!a.last_run) return 1
      if (!b.last_run) return -1
      return new Date(b.last_run).getTime() - new Date(a.last_run).getTime()
    })
  }, [filteredBranches])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => 
          prev < sortedBranches.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < sortedBranches.length) {
          handleSelect(sortedBranches[highlightedIndex].branch)
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }, [sortedBranches, highlightedIndex])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]')
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  const handleSelect = useCallback((branch: string) => {
    onChange(branch)
    setIsOpen(false)
    setSearch("")
    setHighlightedIndex(-1)
  }, [onChange])

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }, [onChange])

  const labelId = `branch-selector-${label.replace(/\s+/g, "-").toLowerCase()}-label`
  const listboxId = `branch-selector-${label.replace(/\s+/g, "-").toLowerCase()}-listbox`

  return (
    <div className="relative" ref={dropdownRef}>
      <label 
        id={labelId}
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
        aria-labelledby={labelId}
        aria-controls={isOpen ? listboxId : undefined}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer ${
          disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : ""
        } ${isOpen ? "ring-2 ring-[oklch(0.75_0.15_195)]" : ""}`}
      >
        {selectedBranch ? (
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{selectedBranch.branch}</p>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${getPassRateColor(
                    selectedBranch.pass_rate
                  )}`}
                  aria-label={`Pass rate: ${selectedBranch.pass_rate}%`}
                >
                  {selectedBranch.pass_rate}%
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {selectedBranch.execution_count} runs • {formatLastRun(selectedBranch.last_run)}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Select a branch...</span>
        )}
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
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
            aria-hidden="true"
          />
        </div>
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg"
        >
          {/* Search input */}
          <div className="border-b border-border p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search branches..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setHighlightedIndex(-1)
              }}
              onKeyDown={handleKeyDown}
              aria-label="Search branches"
              aria-controls={listboxId}
              aria-activedescendant={
                highlightedIndex >= 0 
                  ? `branch-option-${sortedBranches[highlightedIndex]?.branch}` 
                  : undefined
              }
              className="w-full rounded-md bg-muted/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[oklch(0.75_0.15_195)]"
            />
          </div>

          {/* Quick compare button */}
          {showQuickCompare && onQuickCompareWithMain && (
            <div className="border-b border-border p-2">
              <button
                type="button"
                onClick={() => {
                  onQuickCompareWithMain()
                  setIsOpen(false)
                }}
                className="w-full rounded-md bg-[oklch(0.75_0.15_195)]/10 px-3 py-2 text-sm text-[oklch(0.75_0.15_195)] hover:bg-[oklch(0.75_0.15_195)]/20 transition-colors"
              >
                Quick compare with main
              </button>
            </div>
          )}

          {/* Branch list */}
          <div 
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="max-h-72 overflow-y-auto p-1"
          >
            {sortedBranches.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground" role="status">
                No branches found
              </p>
            ) : (
              sortedBranches.map((branch, index) => (
                <button
                  key={branch.branch}
                  id={`branch-option-${branch.branch}`}
                  type="button"
                  role="option"
                  aria-selected={branch.branch === value}
                  onClick={() => handleSelect(branch.branch)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    branch.branch === value 
                      ? "bg-muted/30" 
                      : index === highlightedIndex 
                        ? "bg-muted/20" 
                        : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status indicator */}
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        branch.last_status
                          ? STATUS_COLORS[branch.last_status]
                          : "bg-gray-500"
                      }`}
                      aria-label={`Last status: ${branch.last_status || "unknown"}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {branch.branch}
                        </span>
                        {(branch.branch === "main" || branch.branch === "master") && (
                          <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Hash className="h-3 w-3" aria-hidden="true" />
                          <span>{branch.execution_count} runs</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>{formatLastRun(branch.last_run)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Pass rate badge */}
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${getPassRateColor(
                        branch.pass_rate
                      )}`}
                    >
                      {branch.pass_rate}%
                    </span>
                    {branch.branch === value && (
                      <Check className="h-4 w-4 text-[oklch(0.75_0.15_195)]" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
