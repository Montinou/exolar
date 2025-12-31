"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Table2, LayoutList } from "lucide-react"
import { ExecutionsTable } from "./executions-table"
import { BranchAccordion } from "./branch-accordion"
import type { TestExecution, BranchGroup } from "@/lib/types"

interface ExecutionsViewProps {
  executions: TestExecution[]
  branchGroups: BranchGroup[]
}

export function ExecutionsView({ executions, branchGroups }: ExecutionsViewProps) {
  const [viewMode, setViewMode] = useState<"table" | "accordion">("accordion")

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as "table" | "accordion")}
          className="border rounded-md"
        >
          <ToggleGroupItem value="accordion" aria-label="Accordion view" className="gap-2">
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">By Branch</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="gap-2">
            <Table2 className="h-4 w-4" />
            <span className="hidden sm:inline">Table</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === "table" ? (
        <ExecutionsTable executions={executions} />
      ) : (
        <BranchAccordion branchGroups={branchGroups} />
      )}
    </div>
  )
}
