"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GitBranch, CheckCircle2, XCircle, Loader2, Eye, GitCompare } from "lucide-react"
import type { BranchGroup } from "@/lib/types"
import { TestDetailModal } from "./test-detail-modal"

interface BranchAccordionProps {
  branchGroups: BranchGroup[]
}

export function BranchAccordion({ branchGroups }: BranchAccordionProps) {
  const router = useRouter()
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null)

  const getStatusIcon = (status: "success" | "failure" | "running") => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4" style={{ color: "var(--status-success)" }} />
      case "failure":
        return <XCircle className="h-4 w-4" style={{ color: "var(--status-error)" }} />
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--status-warning)" }} />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (branchGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Executions by Branch</CardTitle>
          <CardDescription>View test runs grouped by branch</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No test executions found. Run your Playwright tests to see results here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Test Executions by Branch</CardTitle>
          <CardDescription>View test runs grouped by branch</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {branchGroups.map((group) => (
              <AccordionItem key={group.branch} value={group.branch}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-col items-start text-left w-full pr-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{group.branch}</span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-sm text-muted-foreground max-w-full">
                      {group.commitMessages.slice(0, 3).map((msg, idx) => (
                        <div key={idx} className="truncate max-w-[600px]" title={msg}>
                          {msg}
                        </div>
                      ))}
                      {group.commitMessages.length === 0 && (
                        <div className="italic">No commit messages available</div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                            Suite
                          </th>
                          <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                            Recent Runs
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.suiteResults.map((suiteResult) => (
                          <tr key={suiteResult.suite} className="border-t">
                            <td className="px-4 py-3 text-sm font-medium">
                              {suiteResult.suite}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  {suiteResult.results.map((result, idx) => (
                                    <DropdownMenu key={idx}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <DropdownMenuTrigger asChild>
                                            <button className="cursor-pointer hover:scale-110 transition-transform">
                                              {getStatusIcon(result.status)}
                                            </button>
                                          </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="capitalize">{result.status}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {formatDate(result.startedAt)}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <DropdownMenuContent align="start">
                                        <DropdownMenuItem
                                          onClick={() => setSelectedExecutionId(result.executionId)}
                                        >
                                          <Eye className="mr-2 h-4 w-4" />
                                          View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            router.push(`/dashboard/compare?current=${result.executionId}`)
                                          }
                                        >
                                          <GitCompare className="mr-2 h-4 w-4" />
                                          Compare with...
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ))}
                                </TooltipProvider>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {selectedExecutionId && (
        <TestDetailModal
          executionId={selectedExecutionId}
          open={!!selectedExecutionId}
          onOpenChange={(open) => !open && setSelectedExecutionId(null)}
        />
      )}
    </>
  )
}
