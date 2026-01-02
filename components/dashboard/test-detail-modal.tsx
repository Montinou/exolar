"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import type { TestExecution, TestResult } from "@/lib/types"
import { TestResultCard } from "./test-result-card"

interface TestDetailModalProps {
  executionId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TestDetailModal({ executionId, open, onOpenChange }: TestDetailModalProps) {
  const [loading, setLoading] = useState(true)
  const [execution, setExecution] = useState<TestExecution | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])

  useEffect(() => {
    if (open && executionId) {
      fetchExecutionDetails()
    }
  }, [executionId, open])

  const fetchExecutionDetails = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/executions/${executionId}`)
      const data = await response.json()
      setExecution(data.execution)
      setTestResults(data.testResults)
    } catch (error) {
      console.error("[v0] Error fetching execution details:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-auto max-h-[90vh] sm:max-h-[80vh]">
          <DialogHeader>
            <Skeleton className="h-8 w-48 sm:w-64" />
            <Skeleton className="h-4 w-full sm:w-96 mt-2" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const failedTests = testResults.filter((t) => t.status === "failed")
  const passedTests = testResults.filter((t) => t.status === "passed")
  const skippedTests = testResults.filter((t) => t.status === "skipped")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-auto max-h-[90vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-base sm:text-lg">Test Execution Details</span>
              <Badge variant={execution?.status === "success" ? "default" : "destructive"}>{execution?.status}</Badge>
            </DialogTitle>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href={`/dashboard/executions/${executionId}`} onClick={() => onOpenChange(false)}>
                <ExternalLink className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Open Full Page</span>
                <span className="sm:hidden">Full</span>
              </Link>
            </Button>
          </div>
          <DialogDescription className="space-y-1">
            <div className="text-xs sm:text-sm flex flex-wrap gap-1">
              <span>Run ID: {execution?.run_id}</span>
              <span className="hidden sm:inline">&bull;</span>
              <span>Branch: {execution?.branch}</span>
              <span className="hidden sm:inline">&bull;</span>
              <span>Commit: {execution?.commit_sha?.substring(0, 7)}</span>
            </div>
            {execution?.commit_message && (
              <div className="text-foreground/80 truncate max-w-full text-xs sm:text-sm" title={execution.commit_message}>
                {execution.commit_message}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="failed" className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="failed" className="text-xs sm:text-sm">Failed ({failedTests.length})</TabsTrigger>
            <TabsTrigger value="passed" className="text-xs sm:text-sm">Passed ({passedTests.length})</TabsTrigger>
            <TabsTrigger value="skipped" className="text-xs sm:text-sm">Skipped ({skippedTests.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="failed" className="space-y-4 m-0 pr-4">
              {failedTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No failed tests</p>
              ) : (
                failedTests.map((test) => (
                  <TestResultCard key={test.id} test={test} variant="full" />
                ))
              )}
            </TabsContent>

            <TabsContent value="passed" className="space-y-4 m-0 pr-4">
              {passedTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No passed tests</p>
              ) : (
                passedTests.map((test) => (
                  <TestResultCard key={test.id} test={test} variant="compact" />
                ))
              )}
            </TabsContent>

            <TabsContent value="skipped" className="space-y-4 m-0 pr-4">
              {skippedTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No skipped tests</p>
              ) : (
                skippedTests.map((test) => (
                  <TestResultCard key={test.id} test={test} variant="compact" />
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
