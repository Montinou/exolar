"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"
import { X } from "lucide-react"

interface FiltersProps {
  branches: string[]
  suites: string[]
}

export function Filters({ branches, suites }: FiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStatus = searchParams.get("status")
  const currentBranch = searchParams.get("branch")
  const currentSuite = searchParams.get("suite")
  const currentFrom = searchParams.get("from")
  const currentTo = searchParams.get("to")

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
    router.push("/")
  }

  const hasFilters = currentStatus || currentBranch || currentSuite || currentFrom || currentTo

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePicker value={dateRange} onChange={updateDateRange} />

      <Select
        value={currentStatus || "all"}
        onValueChange={(value) => updateFilter("status", value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failure">Failure</SelectItem>
          <SelectItem value="running">Running</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={currentSuite || "all"}
        onValueChange={(value) => updateFilter("suite", value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[180px]">
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
        <SelectTrigger className="w-[180px]">
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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
