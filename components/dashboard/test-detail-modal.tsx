"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AlertCircle, CheckCircle2, Clock, FileVideo, Download, ChevronDown, ChevronRight, Globe, Zap, FileText } from "lucide-react"
import type { TestExecution, TestResult, AIFailureContext } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { FlakyBadge } from "./flaky-badge"

// ============================================
// AI Context Section Component
// ============================================

function getErrorTypeVariant(errorType: string): "default" | "destructive" | "outline" | "secondary" {
  const type = errorType.toLowerCase()
  if (type.includes("timeout")) return "secondary"
  if (type.includes("assertion")) return "outline"
  return "destructive"
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-500"
  if (status >= 400 && status < 500) return "text-orange-500"
  if (status >= 500) return "text-red-500"
  return "text-muted-foreground"
}

function getMethodColor(method: string): string {
  const m = method.toUpperCase()
  if (m === "GET") return "bg-blue-500/10 text-blue-600"
  if (m === "POST") return "bg-green-500/10 text-green-600"
  if (m === "PUT" || m === "PATCH") return "bg-yellow-500/10 text-yellow-600"
  if (m === "DELETE") return "bg-red-500/10 text-red-600"
  return "bg-muted text-muted-foreground"
}

function getLogLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case "error": return "text-red-500"
    case "warn": return "text-yellow-500"
    case "info": return "text-blue-500"
    case "debug": return "text-muted-foreground"
    default: return "text-foreground"
  }
}

function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

interface AIContextSectionProps {
  aiContext: AIFailureContext
}

function AIContextSection({ aiContext }: AIContextSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)

  const displaySteps = showAllSteps ? aiContext.steps : aiContext.steps.slice(-10)
  const hasMoreSteps = aiContext.steps.length > 10

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      {/* Compact Summary - Always Visible */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={getErrorTypeVariant(aiContext.error.type)} className="text-xs">
          {aiContext.error.type}
        </Badge>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground truncate max-w-[300px]" title={aiContext.last_step}>
          Last: &quot;{aiContext.last_step}&quot;
        </span>
        {aiContext.retries > 0 && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-orange-500 text-xs">{aiContext.retries} retries</span>
          </>
        )}
      </div>

      {/* Expandable AI Analysis */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            View AI Analysis
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3">
          {/* Error Location */}
          {aiContext.error.location && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Location:</span> {aiContext.error.location}
            </div>
          )}

          {/* Page URL */}
          {aiContext.page_url && (
            <div className="flex items-center gap-2 text-xs">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <a
                href={aiContext.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline truncate max-w-[400px]"
                title={aiContext.page_url}
              >
                {aiContext.page_url}
              </a>
            </div>
          )}

          {/* Test Steps Timeline */}
          {aiContext.steps && aiContext.steps.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Test Steps ({aiContext.steps.length})</span>
                {hasMoreSteps && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs px-2"
                    onClick={() => setShowAllSteps(!showAllSteps)}
                  >
                    {showAllSteps ? "Show last 10" : `Show all ${aiContext.steps.length}`}
                  </Button>
                )}
              </div>
              <div className="bg-muted/30 rounded p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {displaySteps.map((step, index) => {
                  const isLastStep = step === aiContext.last_step
                  const actualIndex = showAllSteps ? index + 1 : aiContext.steps.length - displaySteps.length + index + 1
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-2 text-xs ${isLastStep ? "text-red-500 font-medium" : "text-foreground/80"}`}
                    >
                      <span className="text-muted-foreground w-5 text-right shrink-0">{actualIndex}.</span>
                      <span className={isLastStep ? "bg-red-500/10 px-1 rounded" : ""}>{step}</span>
                      {isLastStep && <span className="text-red-500 text-[10px]">← failed here</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Last API Call */}
          {aiContext.last_api && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Last API Call
              </span>
              <div className="bg-muted/30 rounded p-2 flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${getMethodColor(aiContext.last_api.method)}`}>
                  {aiContext.last_api.method}
                </span>
                <span className="font-mono truncate max-w-[250px]" title={aiContext.last_api.url}>
                  {aiContext.last_api.url}
                </span>
                <span className={`font-mono ${getStatusColor(aiContext.last_api.status)}`}>
                  {aiContext.last_api.status}
                </span>
                {aiContext.last_api.operation && (
                  <span className="text-muted-foreground">
                    ({aiContext.last_api.operation})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Logs */}
          {aiContext.logs && aiContext.logs.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Recent Logs ({aiContext.logs.length})
              </span>
              <ScrollArea className="h-[150px]">
                <div className="bg-muted/30 rounded p-2 space-y-0.5 font-mono text-[10px]">
                  {aiContext.logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">
                        {formatLogTimestamp(log.timestamp)}
                      </span>
                      <span className={`shrink-0 uppercase w-10 ${getLogLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="text-blue-400 shrink-0">{log.source}:</span>
                      <span className="text-foreground/80 break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

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

                    {/* AI Context Section - Displays rich failure analysis */}
                    {test.ai_context && (
                      <AIContextSection aiContext={test.ai_context} />
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
