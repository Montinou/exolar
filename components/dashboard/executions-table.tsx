"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronRight, GitBranch, GitCommit, TestTube } from "lucide-react"
import type { TestExecution } from "@/lib/types"
import { TestDetailModal } from "./test-detail-modal"

interface ExecutionsTableProps {
  executions: TestExecution[]
}

export function ExecutionsTable({ executions }: ExecutionsTableProps) {
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null)

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default",
      failure: "destructive",
      running: "secondary",
    } as const

    return <Badge variant={variants[status as keyof typeof variants] || "secondary"}>{status}</Badge>
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A"
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Executions</CardTitle>
          <CardDescription>View all test runs from GitHub Actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Suite</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No test executions found. Run your Playwright tests to see results here.
                    </TableCell>
                  </TableRow>
                ) : (
                  executions.map((execution) => (
                    <TableRow key={execution.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <GitCommit className="h-3 w-3 text-muted-foreground" />
                          {execution.commit_sha.substring(0, 7)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{execution.branch}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {execution.suite ? (
                          <Badge variant="outline" className="font-normal">
                            <TestTube className="h-3 w-3 mr-1" />
                            {execution.suite}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {execution.commit_message ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block text-sm text-muted-foreground">
                                  {execution.commit_message}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[400px]">
                                <p>{execution.commit_message}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(execution.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-sm">
                          <span className="text-green-600 dark:text-green-400">{execution.passed} passed</span>
                          {execution.failed > 0 && (
                            <span className="text-red-600 dark:text-red-400">{execution.failed} failed</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDuration(execution.duration_ms)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(execution.started_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedExecutionId(execution.id)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
