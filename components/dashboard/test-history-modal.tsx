"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  CheckCircle2, XCircle, Clock, GitBranch, Hash, TrendingUp, AlertTriangle,
  Sparkles, Calendar, ExternalLink
} from "lucide-react"
import Link from "next/link"

interface TestStatistics {
  total_runs: number
  pass_rate: number
  avg_duration_ms: number
  flaky_rate: number
  last_failure: string | null
}

interface TestHistoryItem {
  id: number
  status: string
  duration_ms: number
  started_at: string
  branch: string
  commit_sha: string
  retry_count: number
  error_message?: string
}

interface TestHistoryData {
  test_name: string
  test_file: string
  statistics: TestStatistics
  history: TestHistoryItem[]
}

interface SimilarFailure {
  testResultId: number
  executionId: number
  testName: string
  errorMessage: string | null
  similarity: number
  branch: string
  createdAt: string
}

interface TestHistoryModalProps {
  signature: string
  onClose: () => void
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.95) return "bg-green-500/10 text-green-500 border-green-500/30"
  if (similarity >= 0.85) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
  return "bg-orange-500/10 text-orange-500 border-orange-500/30"
}

export function TestHistoryModal({ signature, onClose }: TestHistoryModalProps) {
  const [data, setData] = useState<TestHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [similar, setSimilar] = useState<SimilarFailure[]>([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [similarFetched, setSimilarFetched] = useState(false)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/tests/${signature}`)
        if (response.ok) {
          const json = await response.json()
          setData(json)
        }
      } catch (error) {
        console.error("Failed to fetch test history:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [signature])

  const fetchSimilar = async () => {
    if (similarFetched || !data?.history.length) return
    
    // Find a recent failed test to search from
    const failedTest = data.history.find(h => h.status !== "passed")
    if (!failedTest) {
      setSimilarFetched(true)
      return
    }

    setSimilarLoading(true)
    try {
      const response = await fetch(
        `/api/failures/${failedTest.id}/similar?mode=historical&limit=10&days=30`
      )
      if (response.ok) {
        const result = await response.json()
        setSimilar(result.similar || [])
      }
    } catch (error) {
      console.error("Failed to fetch similar failures:", error)
    } finally {
      setSimilarLoading(false)
      setSimilarFetched(true)
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const hasFailures = data?.history.some(h => h.status !== "passed")

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{loading ? "Loading..." : data?.test_name}</DialogTitle>
          {data && <p className="text-sm text-muted-foreground">{data.test_file}</p>}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading test history...</div>
        ) : data ? (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold">{data.statistics.pass_rate}%</p>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Hash className="h-5 w-5 mx-auto mb-1" />
                <p className="text-2xl font-bold">{data.statistics.total_runs}</p>
                <p className="text-xs text-muted-foreground">Total Runs</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-1" />
                <p className="text-2xl font-bold">{formatDuration(data.statistics.avg_duration_ms)}</p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold">{data.statistics.flaky_rate}%</p>
                <p className="text-xs text-muted-foreground">Flaky Rate</p>
              </div>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="history" className="flex-1">Recent Runs</TabsTrigger>
                <TabsTrigger 
                  value="similar" 
                  className="flex-1"
                  onClick={fetchSimilar}
                  disabled={!hasFailures}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Similar Issues
                </TabsTrigger>
              </TabsList>

              {/* History Tab */}
              <TabsContent value="history" className="mt-4">
                <div className="space-y-2">
                  {(data.history || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.status === "passed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{item.branch}</span>
                            <code className="text-xs text-muted-foreground">{item.commit_sha.substring(0, 7)}</code>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(item.started_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.retry_count > 0 && (
                          <Badge variant="outline" className="text-amber-600">
                            Retry {item.retry_count}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">{formatDuration(item.duration_ms)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Similar Issues Tab */}
              <TabsContent value="similar" className="mt-4">
                {!hasFailures ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium">No failures to compare</p>
                    <p className="text-sm">This test has no recent failures.</p>
                  </div>
                ) : similarLoading ? (
                  <div className="space-y-4 py-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : similar.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg font-medium">No similar failures found</p>
                    <p className="text-sm">This failure appears to be unique in the last 30 days.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Found {similar.length} similar failure{similar.length !== 1 ? "s" : ""} in the last 30 days
                    </p>
                    {similar.map((failure) => (
                      <div
                        key={`${failure.executionId}-${failure.testResultId}`}
                        className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={getSimilarityColor(failure.similarity)}>
                                {Math.round(failure.similarity * 100)}% match
                              </Badge>
                            </div>
                            <p className="font-medium truncate" title={failure.testName}>
                              {failure.testName}
                            </p>
                            {failure.errorMessage && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                                {failure.errorMessage}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {failure.branch}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDateShort(failure.createdAt)}
                              </span>
                            </div>
                          </div>
                          <Link href={`/dashboard/executions/${failure.executionId}`}>
                            <Button variant="ghost" size="sm" className="shrink-0">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Test not found</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

