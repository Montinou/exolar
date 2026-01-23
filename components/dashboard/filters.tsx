"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { format, parseISO, differenceInDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"
import { X } from "lucide-react"

interface FiltersProps {
  branches: string[]
  suites: string[]
  basePath?: string
  showStatus?: boolean
}

export function Filters({ branches, suites, basePath, showStatus = true }: FiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const currentStatus = searchParams.get("status")
  const currentBranch = searchParams.get("branch")
  const currentSuite = searchParams.get("suite")
  const currentFrom = searchParams.get("from")
  const currentTo = searchParams.get("to")
  const currentHistoric = searchParams.get("historic") === "true"

  // Show historic checkbox when branch or suite filter is applied
  const hasFilter = !!(currentBranch || currentSuite)

  const dateRange: DateRange | undefined =
    currentFrom || currentTo
      ? {
          from: currentFrom ? parseISO(currentFrom) : undefined,
          to: currentTo ? parseISO(currentTo) : undefined,
        }
      : undefined

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  const updateDateRange = (range: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (range?.from) {
      params.set("from", format(range.from, "yyyy-MM-dd"))
    } else {
      params.delete("from")
    }
    if (range?.to) {
      params.set("to", format(range.to, "yyyy-MM-dd"))
    } else {
      params.delete("to")
    }
    router.push(`?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push(basePath || pathname)
  }

  const hasFilters = (showStatus && currentStatus) || currentBranch || currentSuite || currentFrom || currentTo

  // Calculate period label for showing active time range
  const getPeriodLabel = () => {
    if (currentFrom && currentTo) {
      const fromDate = parseISO(currentFrom)
      const toDate = parseISO(currentTo)
      const days = differenceInDays(toDate, fromDate) + 1
      return `${days} day${days !== 1 ? "s" : ""} selected`
    }
    if (currentFrom) {
      return `From ${currentFrom}`
    }
    if (currentTo) {
      return `Until ${currentTo}`
    }
    return "Last 15 days"
  }

  return (
    <div
      className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 p-4 rounded-xl animate-fade-in-up"
      style={{
        background: "oklch(0.1 0.015 260 / 0.4)",
        border: "1px solid oklch(1 0 0 / 0.06)",
        backdropFilter: "blur(8px)",
      }}
    >
      <DateRangePicker value={dateRange} onChange={updateDateRange} className="w-full sm:w-auto" />

      <span
        className="text-xs whitespace-nowrap hidden sm:inline-flex items-center px-2.5 py-1 rounded-md"
        style={{
          background: "oklch(0.75 0.15 195 / 0.1)",
          color: "var(--exolar-cyan)",
        }}
      >
        {getPeriodLabel()}
      </span>

      <div className="h-6 w-px bg-border/50 hidden sm:block" />

      {showStatus && (
        <Select
          value={currentStatus || "all"}
          onValueChange={(value) => updateFilter("status", value === "all" ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-[150px] transition-all duration-200 hover:border-[var(--exolar-cyan)]/40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select
        value={currentSuite || "all"}
        onValueChange={(value) => updateFilter("suite", value === "all" ? null : value)}
      >
        <SelectTrigger className="w-full sm:w-[180px] transition-all duration-200 hover:border-[var(--exolar-cyan)]/40">
          <SelectValue placeholder="Suite" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suites</SelectItem>
          {suites.map((suite) => (
            <SelectItem key={suite} value={suite}>
              {suite}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentBranch || "all"}
        onValueChange={(value) => updateFilter("branch", value === "all" ? null : value)}
      >
        <SelectTrigger className="w-full sm:w-[180px] transition-all duration-200 hover:border-[var(--exolar-cyan)]/40">
          <SelectValue placeholder="Branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Branches</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch} value={branch}>
              {branch}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Historic Summary switch - only shows when branch/suite filter is applied */}
      {hasFilter && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200"
          style={{
            background: currentHistoric ? "oklch(0.75 0.15 195 / 0.1)" : "transparent",
          }}
        >
          <Label htmlFor="historic" className="text-sm cursor-pointer whitespace-nowrap">
            Historic Summary
          </Label>
          <Switch
            id="historic"
            checked={currentHistoric}
            onCheckedChange={(checked) => {
              const params = new URLSearchParams(searchParams.toString())
              if (checked) {
                params.set("historic", "true")
              } else {
                params.delete("historic")
              }
              router.push(`?${params.toString()}`)
            }}
          />
        </div>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full sm:w-auto text-muted-foreground hover:text-foreground hover:bg-destructive/10 transition-all duration-200"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
