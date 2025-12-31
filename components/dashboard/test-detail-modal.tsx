"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, CheckCircle2, Clock, FileVideo, Download } from "lucide-react"
import type { TestExecution, TestResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { FlakyBadge } from "./flaky-badge"

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

  const getStatusIcon = (status: string) => {
    if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (status === "failed") return <AlertCircle className="h-4 w-4 text-red-500" />
    return <Clock className="h-4 w-4 text-yellow-500" />
  }

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
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
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Test Execution Details</span>
            <Badge variant={execution?.status === "success" ? "default" : "destructive"}>{execution?.status}</Badge>
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div>Run ID: {execution?.run_id} • Branch: {execution?.branch} • Commit: {execution?.commit_sha?.substring(0, 7)}</div>
            {execution?.commit_message && (
              <div className="text-foreground/80 truncate max-w-full" title={execution.commit_message}>
                {execution.commit_message}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="failed" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="failed">Failed ({failedTests.length})</TabsTrigger>
            <TabsTrigger value="passed">Passed ({passedTests.length})</TabsTrigger>
            <TabsTrigger value="skipped">Skipped ({skippedTests.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 h-0 min-h-0">
            <TabsContent value="failed" className="space-y-4 m-0">
              {failedTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No failed tests</p>
              ) : (
                failedTests.map((test) => (
                  <div key={test.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(test.status)}
                          <h4 className="font-semibold text-sm">{test.test_name}</h4>
                          {test.is_critical && (
                            <Badge variant="destructive" className="text-xs">
                              Critical
                            </Badge>
                          )}
                          {(test.is_flaky || (test.retry_count > 0 && test.status === "passed")) && (
                            <FlakyBadge
                              flakinessRate={test.retry_count > 0 ? 100 : undefined}
                              showTooltip={false}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{test.test_file}</p>
                        <p className="text-xs text-muted-foreground">
                          Duration: {formatDuration(test.duration_ms)} • Browser: {test.browser}
                        </p>
                      </div>
                    </div>

                    {test.error_message && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                        <p className="text-sm font-medium text-destructive mb-2">Error Message:</p>
                        <p className="text-xs font-mono text-destructive/90">{test.error_message}</p>
                      </div>
                    )}

                    {test.stack_trace && (
                      <div className="bg-muted rounded p-3">
                        <p className="text-sm font-medium mb-2">Stack Trace:</p>
                        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">{test.stack_trace}</pre>
                      </div>
                    )}

                    {test.artifacts && test.artifacts.length > 0 && (
                      <div className="flex gap-2 pt-2 border-t">
                        {test.artifacts.map((artifact) => (
                          <Button key={artifact.id} variant="outline" size="sm" asChild>
                            <a
                              href={artifact.r2_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              {artifact.type === "video" ? (
                                <FileVideo className="h-3 w-3" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              {artifact.type}
                            </a>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="passed" className="space-y-4 m-0">
              {passedTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No passed tests</p>
              ) : (
                passedTests.map((test) => (
                  <div key={test.id} className="border rounded-lg p-4 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(test.status)}
                      <h4 className="font-semibold text-sm">{test.test_name}</h4>
                      {(test.is_flaky || test.retry_count > 0) && (
                        <FlakyBadge
                          flakinessRate={test.retry_count > 0 ? 100 : undefined}
                          showTooltip={false}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{test.test_file}</p>
                    <p className="text-xs text-muted-foreground">
                      Duration: {formatDuration(test.duration_ms)} • Browser: {test.browser}
                      {test.retry_count > 0 && ` • Retries: ${test.retry_count}`}
                    </p>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="skipped" className="space-y-4 m-0">
              {skippedTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No skipped tests</p>
              ) : (
                skippedTests.map((test) => (
                  <div key={test.id} className="border rounded-lg p-4 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(test.status)}
                      <h4 className="font-semibold text-sm">{test.test_name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{test.test_file}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
