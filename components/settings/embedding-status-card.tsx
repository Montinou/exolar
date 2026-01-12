"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Brain, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface EmbeddingStatus {
  withEmbedding: number
  total: number
  needsEmbedding: number
  percentComplete: string
  message: string
}

interface BackfillResult {
  message: string
  stats: {
    total: number
    succeeded: number
    failed: number
    skipped: number
    durationMs: number
  }
}

export function EmbeddingStatusCard() {
  const [status, setStatus] = useState<EmbeddingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/admin/backfill-embeddings")
      if (response.status === 403) {
        // Not admin, hide the card
        setIsAdmin(false)
        return
      }
      if (!response.ok) throw new Error("Failed to fetch status")
      const data = await response.json()
      setStatus(data)
      setIsAdmin(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      const response = await fetch("/api/admin/backfill-embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500 }),
      })
      if (!response.ok) throw new Error("Backfill failed")
      const result: BackfillResult = await response.json()
      
      toast.success(
        `Processed ${result.stats.succeeded} of ${result.stats.total} tests (${result.stats.failed} failed)`
      )
      
      // Refresh status
      await fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backfill failed")
    } finally {
      setBackfilling(false)
    }
  }

  // Don't render for non-admins
  if (!loading && !isAdmin) return null

  if (loading) {
    return (
      <Card className="glass-card glass-card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Embeddings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="glass-card glass-card-glow border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Embeddings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const coverage = parseFloat(status.percentComplete)
  const isComplete = status.needsEmbedding === 0

  return (
    <Card className="glass-card glass-card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-cyan-400" />
          AI Embeddings
        </CardTitle>
        <CardDescription>
          Vector embeddings enable semantic search and failure clustering
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Coverage</span>
            <span className={`font-semibold ${isComplete ? "text-green-500" : "text-cyan-400"}`}>
              {status.percentComplete}%
            </span>
          </div>
          <Progress value={coverage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {status.withEmbedding} of {status.total} failures indexed
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {isComplete ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-green-500">All tests have embeddings</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-500">{status.needsEmbedding} tests need embeddings</span>
            </>
          )}
        </div>

        {/* Actions */}
        {!isComplete && (
          <Button
            onClick={handleBackfill}
            disabled={backfilling}
            variant="secondary"
            className="w-full"
          >
            {backfilling ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Missing Embeddings
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
