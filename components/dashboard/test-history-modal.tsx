"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Clock, GitBranch, Hash, TrendingUp, AlertTriangle } from "lucide-react"

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

interface TestHistoryModalProps {
  signature: string
  onClose: () => void
}

export function TestHistoryModal({ signature, onClose }: TestHistoryModalProps) {
  const [data, setData] = useState<TestHistoryData | null>(null)
  const [loading, setLoading] = useState(true)

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

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

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

            {/* History */}
            <div>
              <h3 className="font-medium mb-3">Recent Runs</h3>
              <div className="space-y-2">
                {data.history.map((item) => (
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
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Test not found</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
