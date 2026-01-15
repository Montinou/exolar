"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { MockRequestLog } from "@/lib/types"

interface MockLogsViewerProps {
  interfaceId: number
  interfaceName: string
}

interface LogStats {
  total: number
  matched: number
  unmatched: number
  byStatus: { status: string; count: number }[]
  byMethod: { method: string; count: number }[]
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]
const STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "2xx", label: "2xx Success" },
  { value: "3xx", label: "3xx Redirect" },
  { value: "4xx", label: "4xx Client Error" },
  { value: "5xx", label: "5xx Server Error" },
]

const PAGE_SIZES = [25, 50, 100, 250]

export function MockLogsViewer({ interfaceId, interfaceName }: MockLogsViewerProps) {
  // Filter state
  const [pathFilter, setPathFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [matchedFilter, setMatchedFilter] = useState<boolean | null>(null)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Data state
  const [logs, setLogs] = useState<MockRequestLog[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Build query string from filters
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()
    if (pathFilter) params.set("path", pathFilter)
    if (methodFilter !== "all") params.set("method", methodFilter)
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (matchedFilter !== null) params.set("matched", String(matchedFilter))
    if (fromDate) params.set("from", new Date(fromDate).toISOString())
    if (toDate) params.set("to", new Date(toDate).toISOString())
    params.set("limit", String(pageSize))
    params.set("offset", String((page - 1) * pageSize))
    return params.toString()
  }, [pathFilter, methodFilter, statusFilter, matchedFilter, fromDate, toDate, page, pageSize])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const queryString = buildQueryString()
      const res = await fetch(`/api/mocks/${interfaceId}/logs?${queryString}`)
      if (!res.ok) {
        throw new Error("Failed to fetch logs")
      }
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs")
    } finally {
      setLoading(false)
    }
  }, [interfaceId, buildQueryString])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/mocks/${interfaceId}/logs`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // Stats are optional, don't show error
    } finally {
      setStatsLoading(false)
    }
  }, [interfaceId])

  // Initial load
  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [fetchLogs, fetchStats])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [pathFilter, methodFilter, statusFilter, matchedFilter, fromDate, toDate, pageSize])

  // Refetch when page changes
  useEffect(() => {
    fetchLogs()
  }, [page, fetchLogs])

  // Export functions
  const exportData = (format: "json" | "csv") => {
    if (logs.length === 0) return

    let content: string
    let filename: string
    let mimeType: string

    if (format === "json") {
      content = JSON.stringify(logs, null, 2)
      filename = `mock-logs-${interfaceName}-${new Date().toISOString().split("T")[0]}.json`
      mimeType = "application/json"
    } else {
      // CSV export
      const headers = [
        "id",
        "method",
        "path",
        "response_status",
        "matched",
        "response_time_ms",
        "request_at",
      ]
      const rows = logs.map((log) =>
        [
          log.id,
          log.method,
          `"${log.path}"`,
          log.response_status,
          log.matched,
          log.response_time_ms,
          log.request_at,
        ].join(",")
      )
      content = [headers.join(","), ...rows].join("\n")
      filename = `mock-logs-${interfaceName}-${new Date().toISOString().split("T")[0]}.csv`
      mimeType = "text/csv"
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string, logId: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(logId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500/20 text-green-500"
    if (status >= 300 && status < 400) return "bg-yellow-500/20 text-yellow-500"
    if (status >= 400 && status < 500) return "bg-orange-500/20 text-orange-500"
    return "bg-red-500/20 text-red-500"
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-blue-500/20 text-blue-500"
      case "POST":
        return "bg-green-500/20 text-green-500"
      case "PUT":
        return "bg-yellow-500/20 text-yellow-500"
      case "DELETE":
        return "bg-red-500/20 text-red-500"
      case "PATCH":
        return "bg-purple-500/20 text-purple-500"
      default:
        return "bg-gray-500/20 text-gray-500"
    }
  }

  const formatJson = (str: string | null | undefined): string => {
    if (!str) return ""
    try {
      return JSON.stringify(JSON.parse(str), null, 2)
    } catch {
      return str
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Matched
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-500">
                  {stats.matched.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" />
                Unmatched
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-red-500">
                  {stats.unmatched.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                By Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {stats.byStatus.map((s) => (
                    <Badge
                      key={s.status}
                      variant="outline"
                      className={
                        s.status === "2xx"
                          ? "bg-green-500/10 text-green-500"
                          : s.status === "4xx"
                            ? "bg-orange-500/10 text-orange-500"
                            : s.status === "5xx"
                              ? "bg-red-500/10 text-red-500"
                              : ""
                      }
                    >
                      {s.status}: {s.count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Path search */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Path</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search path..."
                  value={pathFilter}
                  onChange={(e) => setPathFilter(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Method filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Matched filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Matched</Label>
              <Select
                value={matchedFilter === null ? "all" : String(matchedFilter)}
                onValueChange={(v) =>
                  setMatchedFilter(v === "all" ? null : v === "true")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Matched Only</SelectItem>
                  <SelectItem value="false">Unmatched Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPathFilter("")
                  setMethodFilter("all")
                  setStatusFilter("all")
                  setMatchedFilter(null)
                  setFromDate("")
                  setToDate("")
                }}
              >
                Clear Filters
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchLogs()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportData("json")}>
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("csv")}>
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Request Logs ({total.toLocaleString()} total)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Per page:</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No logs found matching filters
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    {/* Log Header */}
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() =>
                        setExpandedLog(expandedLog === log.id ? null : log.id)
                      }
                    >
                      <Badge className={getMethodColor(log.method)}>
                        {log.method}
                      </Badge>
                      <span className="font-mono text-sm flex-1 truncate">
                        {log.path}
                      </span>
                      <Badge className={getStatusColor(log.response_status)}>
                        {log.response_status}
                      </Badge>
                      {log.matched ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {log.response_time_ms}ms
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.request_at).toLocaleString()}
                      </span>
                      {expandedLog === log.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>

                    {/* Expanded Details */}
                    {expandedLog === log.id && (
                      <div className="border-t p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Request */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium">Request</Label>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  copyToClipboard(
                                    JSON.stringify(
                                      {
                                        headers: log.headers,
                                        query: log.query_params,
                                        body: log.body,
                                      },
                                      null,
                                      2
                                    ),
                                    log.id
                                  )
                                }
                              >
                                {copiedId === log.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>

                            {log.headers && Object.keys(log.headers).length > 0 && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Headers
                                </Label>
                                <pre className="text-xs font-mono bg-muted/50 p-2 rounded overflow-auto max-h-32">
                                  {formatJson(JSON.stringify(log.headers))}
                                </pre>
                              </div>
                            )}

                            {log.query_params &&
                              Object.keys(log.query_params).length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">
                                    Query Params
                                  </Label>
                                  <pre className="text-xs font-mono bg-muted/50 p-2 rounded overflow-auto max-h-32">
                                    {formatJson(JSON.stringify(log.query_params))}
                                  </pre>
                                </div>
                              )}

                            {log.body && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Body
                                </Label>
                                <pre className="text-xs font-mono bg-muted/50 p-2 rounded overflow-auto max-h-32">
                                  {formatJson(log.body)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Response */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Response</Label>

                            {log.response_body && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Body
                                </Label>
                                <pre className="text-xs font-mono bg-muted/50 p-2 rounded overflow-auto max-h-48">
                                  {formatJson(log.response_body)}
                                </pre>
                              </div>
                            )}

                            {log.validation_errors && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground text-orange-500">
                                  Validation Errors
                                </Label>
                                <pre className="text-xs font-mono bg-orange-500/10 p-2 rounded overflow-auto max-h-32 text-orange-500">
                                  {formatJson(JSON.stringify(log.validation_errors))}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {log.route_id && (
                            <Badge variant="outline">Route ID: {log.route_id}</Badge>
                          )}
                          {log.rule_id && (
                            <Badge variant="outline">Rule ID: {log.rule_id}</Badge>
                          )}
                          <Badge variant="outline">Log ID: {log.id}</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
