"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ArrowLeft, Calendar, GitBranch, Hash, Clock, CheckCircle2, XCircle, AlertTriangle, Copy, Check, List, Layers } from "lucide-react"
import type { TestExecution, TestResult } from "@/lib/types"
import { TestResultCard } from "@/components/dashboard/test-result-card"
import { UserMenu } from "@/components/dashboard/user-menu"
import { ClusteredFailuresView } from "@/components/dashboard/clustered-failures-view"
import { SimilarFailuresModal } from "@/components/dashboard/similar-failures-modal"

export default function ExecutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [execution, setExecution] = useState<TestExecution | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [failedViewMode, setFailedViewMode] = useState<"list" | "clustered">("list")
  const [similarModalTestId, setSimilarModalTestId] = useState<number | null>(null)
  const [similarModalTestName, setSimilarModalTestName] = useState<string | undefined>()

  useEffect(() => {
    loadExecutionData()
  }, [id])

  async function loadExecutionData() {
    try {
      const response = await fetch(`/api/executions/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError("Execution not found")
        } else if (response.status === 401) {
          setError("Unauthorized")
        } else {
          setError("Failed to load execution")
        }
        setLoading(false)
        return
      }
      const data = await response.json()
      setExecution(data.execution)
      setTestResults(data.testResults || [])
    } catch (err) {
      console.error("Failed to load execution:", err)
      setError("Failed to load execution")
    } finally {
      setLoading(false)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function formatDuration(ms: number) {
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !execution) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{error || "Execution Not Found"}</CardTitle>
            <CardDescription>
              The test execution you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const failedTests = testResults.filter((t) => t.status === "failed")
  const passedTests = testResults.filter((t) => t.status === "passed")
  const skippedTests = testResults.filter((t) => t.status === "skipped")
  const totalDuration = testResults.reduce((sum, t) => sum + (t.duration_ms || 0), 0)

  function handleFindSimilar(testResultId: number) {
    const test = testResults.find(t => t.id === testResultId)
    setSimilarModalTestName(test?.test_name)
    setSimilarModalTestId(testResultId)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1
                    className="text-xl sm:text-2xl font-bold"
                    style={{
                      background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >Test Execution Details</h1>
                  <Badge variant={execution.status === "success" ? "default" : "destructive"}>
                    {execution.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Run #{execution.run_id} &bull; {formatDate(execution.started_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyUrl}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </>
                )}
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card glass-card-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{testResults.length}</div>
              <p className="text-xs text-muted-foreground">
                {failedTests.length} failed, {passedTests.length} passed
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalDuration)}</div>
              <p className="text-xs text-muted-foreground">
                Total execution time
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Branch</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate" title={execution.branch}>
                {execution.branch}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {execution.commit_sha?.substring(0, 7)}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              {execution.status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {testResults.length > 0
                  ? `${Math.round((passedTests.length / testResults.length) * 100)}%`
                  : "N/A"
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {skippedTests.length} skipped
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Commit Message */}
        {execution.commit_message && (
          <Card className="glass-card glass-card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commit Message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{execution.commit_message}</p>
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Detailed breakdown of all test cases in this execution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="failed">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="failed" className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Failed ({failedTests.length})
                </TabsTrigger>
                <TabsTrigger value="passed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Passed ({passedTests.length})
                </TabsTrigger>
                <TabsTrigger value="skipped" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Skipped ({skippedTests.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="failed" className="space-y-4">
                {failedTests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium">All tests passed!</p>
                    <p className="text-sm">No failed tests in this execution.</p>
                  </div>
                ) : (
                  <>
                    {/* View mode toggle */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {failedTests.length} failed test{failedTests.length !== 1 ? "s" : ""}
                      </p>
                      <ToggleGroup
                        type="single"
                        value={failedViewMode}
                        onValueChange={(value) => value && setFailedViewMode(value as "list" | "clustered")}
                        className="bg-muted rounded-lg p-1"
                      >
                        <ToggleGroupItem value="list" aria-label="List view" className="h-7 px-3 text-xs data-[state=on]:bg-background">
                          <List className="h-3 w-3 mr-1" />
                          List
                        </ToggleGroupItem>
                        <ToggleGroupItem value="clustered" aria-label="Clustered view" className="h-7 px-3 text-xs data-[state=on]:bg-background">
                          <Layers className="h-3 w-3 mr-1" />
                          Clustered
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* List view */}
                    {failedViewMode === "list" && (
                      <div className="space-y-4">
                        {failedTests.map((test) => (
                          <TestResultCard key={test.id} test={test} variant="full" />
                        ))}
                      </div>
                    )}

                    {/* Clustered view */}
                    {failedViewMode === "clustered" && (
                      <ClusteredFailuresView
                        executionId={parseInt(id, 10)}
                        onFindSimilar={handleFindSimilar}
                      />
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="passed" className="space-y-4">
                {passedTests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg font-medium">No passed tests</p>
                    <p className="text-sm">All tests failed or were skipped.</p>
                  </div>
                ) : (
                  passedTests.map((test) => (
                    <TestResultCard key={test.id} test={test} variant="compact" />
                  ))
                )}
              </TabsContent>

              <TabsContent value="skipped" className="space-y-4">
                {skippedTests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium">No skipped tests</p>
                    <p className="text-sm">All tests were executed.</p>
                  </div>
                ) : (
                  skippedTests.map((test) => (
                    <TestResultCard key={test.id} test={test} variant="compact" />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Similar Failures Modal */}
      {similarModalTestId && (
        <SimilarFailuresModal
          testResultId={similarModalTestId}
          testName={similarModalTestName}
          onClose={() => {
            setSimilarModalTestId(null)
            setSimilarModalTestName(undefined)
          }}
        />
      )}
    </div>
  )
}
