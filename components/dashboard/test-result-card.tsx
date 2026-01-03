"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AlertCircle, CheckCircle2, Clock, FileVideo, Download, ChevronDown, ChevronRight, Globe, Zap, FileText, Loader2 } from "lucide-react"
import type { TestResult, AIFailureContext, TestArtifact } from "@/lib/types"
import { FlakyBadge } from "./flaky-badge"

// ============================================
// Helper Functions
// ============================================

function getStatusIcon(status: string) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4" style={{ color: "var(--status-success)" }} />
  if (status === "failed") return <AlertCircle className="h-4 w-4" style={{ color: "var(--status-error)" }} />
  return <Clock className="h-4 w-4" style={{ color: "var(--status-warning)" }} />
}

function formatDuration(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`
}

function getErrorTypeVariant(errorType: string): "default" | "destructive" | "outline" | "secondary" {
  const type = errorType.toLowerCase()
  if (type.includes("timeout")) return "secondary"
  if (type.includes("assertion")) return "outline"
  return "destructive"
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-[var(--status-success)]"
  if (status >= 400 && status < 500) return "text-[var(--status-warning)]"
  if (status >= 500) return "text-[var(--status-error)]"
  return "text-muted-foreground"
}

function getMethodColor(method: string): string {
  const m = method.toUpperCase()
  if (m === "GET") return "bg-[var(--method-get-bg)] text-[var(--method-get)]"
  if (m === "POST") return "bg-[var(--method-post-bg)] text-[var(--method-post)]"
  if (m === "PUT" || m === "PATCH") return "bg-[var(--method-put-bg)] text-[var(--method-put)]"
  if (m === "DELETE") return "bg-[var(--method-delete-bg)] text-[var(--method-delete)]"
  return "bg-muted text-muted-foreground"
}

function getLogLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case "error": return "text-[var(--status-error)]"
    case "warn": return "text-[var(--status-warning)]"
    case "info": return "text-[var(--status-info)]"
    case "debug": return "text-muted-foreground"
    default: return "text-foreground"
  }
}

function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ============================================
// AI Context Section Component
// ============================================

interface AIContextSectionProps {
  aiContext: AIFailureContext
}

function AIContextSection({ aiContext }: AIContextSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)

  const steps = aiContext.steps || []
  const displaySteps = showAllSteps ? steps : steps.slice(-10)
  const hasMoreSteps = steps.length > 10

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      {/* Compact Summary - Always Visible */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={getErrorTypeVariant(aiContext.error.type)} className="text-xs">
          {aiContext.error.type}
        </Badge>
        <span className="text-muted-foreground">&bull;</span>
        <span className="text-muted-foreground truncate max-w-[300px]" title={aiContext.last_step}>
          Last: &quot;{aiContext.last_step}&quot;
        </span>
        {aiContext.retries > 0 && (
          <>
            <span className="text-muted-foreground">&bull;</span>
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
          {steps.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Test Steps ({steps.length})</span>
                {hasMoreSteps && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs px-2"
                    onClick={() => setShowAllSteps(!showAllSteps)}
                  >
                    {showAllSteps ? "Show last 10" : `Show all ${steps.length}`}
                  </Button>
                )}
              </div>
              <div className="bg-muted/30 rounded p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {displaySteps.map((step, index) => {
                  const isLastStep = step === aiContext.last_step
                  const actualIndex = showAllSteps ? index + 1 : steps.length - displaySteps.length + index + 1
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-2 text-xs ${isLastStep ? "text-red-500 font-medium" : "text-foreground/80"}`}
                    >
                      <span className="text-muted-foreground w-5 text-right shrink-0">{actualIndex}.</span>
                      <span className={isLastStep ? "bg-red-500/10 px-1 rounded" : ""}>{step}</span>
                      {isLastStep && <span className="text-red-500 text-[10px]">&larr; failed here</span>}
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

// ============================================
// Artifact Download Button Component
// ============================================

interface ArtifactDownloadButtonProps {
  artifact: TestArtifact
}

function ArtifactDownloadButton({ artifact }: ArtifactDownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/artifacts/${artifact.id}/signed-url`)
      if (!response.ok) {
        throw new Error('Failed to get download URL')
      }
      const { signed_url } = await response.json()
      window.open(signed_url, '_blank')
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : artifact.type === "video" ? (
        <FileVideo className="h-3 w-3" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      {artifact.type}
    </Button>
  )
}

// ============================================
// Test Result Card Component
// ============================================

interface TestResultCardProps {
  test: TestResult
  variant?: "compact" | "full"
}

export function TestResultCard({ test, variant = "full" }: TestResultCardProps) {
  const isFailed = test.status === "failed"
  const isPassed = test.status === "passed"
  const isSkipped = test.status === "skipped"

  // Get border class based on status
  const getBorderClass = () => {
    if (isPassed) return "status-border-success"
    if (isFailed) return "status-border-error"
    return "status-border-warning"
  }

  // Compact variant for passed/skipped tests
  if (variant === "compact" || isSkipped) {
    return (
      <div className={`glass-card p-4 space-y-2 ${getBorderClass()}`}>
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
        {!isSkipped && (
          <p className="text-xs text-muted-foreground">
            Duration: {formatDuration(test.duration_ms)} &bull; Browser: {test.browser}
            {test.retry_count > 0 && ` • Retries: ${test.retry_count}`}
          </p>
        )}
      </div>
    )
  }

  // Full variant for failed tests (or passed with full details)
  return (
    <div className={`glass-card p-4 space-y-3 ${getBorderClass()}`}>
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
            {(test.is_flaky || (test.retry_count > 0 && isPassed)) && (
              <FlakyBadge
                flakinessRate={test.retry_count > 0 ? 100 : undefined}
                showTooltip={false}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{test.test_file}</p>
          <p className="text-xs text-muted-foreground">
            Duration: {formatDuration(test.duration_ms)} &bull; Browser: {test.browser}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {isFailed && test.error_message && (
        <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
          <p className="text-sm font-medium text-destructive mb-2">Error Message:</p>
          <p className="text-xs font-mono text-destructive/90">{test.error_message}</p>
        </div>
      )}

      {/* Stack Trace */}
      {isFailed && test.stack_trace && (
        <div className="bg-muted rounded p-3">
          <p className="text-sm font-medium mb-2">Stack Trace:</p>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">{test.stack_trace}</pre>
        </div>
      )}

      {/* AI Context Section - Displays rich failure analysis */}
      {isFailed && test.ai_context && (
        <AIContextSection aiContext={test.ai_context} />
      )}

      {/* Artifacts */}
      {test.artifacts && test.artifacts.length > 0 && (
        <div className="flex gap-2 pt-2 border-t">
          {test.artifacts.map((artifact) => (
            <ArtifactDownloadButton key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )}
    </div>
  )
}

// Export helper functions for use in other components
export { getStatusIcon, formatDuration }
