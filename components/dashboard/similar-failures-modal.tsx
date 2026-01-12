"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  GitBranch,
  Calendar,
  Sparkles,
  ExternalLink,
  AlertCircle
} from "lucide-react"
import Link from "next/link"

// ============================================
// Types
// ============================================

interface SimilarFailure {
  testResultId: number
  executionId: number
  testName: string
  errorMessage: string | null
  similarity: number
  branch: string
  createdAt: string
}

interface SimilarFailuresModalProps {
  testResultId: number
  testName?: string
  onClose: () => void
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.95) return "bg-green-500/10 text-green-500 border-green-500/30"
  if (similarity >= 0.85) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
  return "bg-orange-500/10 text-orange-500 border-orange-500/30"
}

// ============================================
// Similar Failures Modal Component
// ============================================

export function SimilarFailuresModal({
  testResultId,
  testName,
  onClose
}: SimilarFailuresModalProps) {
  const [similar, setSimilar] = useState<SimilarFailure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSimilar() {
      try {
        const response = await fetch(
          `/api/failures/${testResultId}/similar?mode=historical&limit=10&days=30`
        )
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to find similar failures")
        }
        const data = await response.json()
        setSimilar(data.similar || [])
      } catch (err) {
        console.error("Failed to fetch similar failures:", err)
        setError(err instanceof Error ? err.message : "Failed to load similar failures")
      } finally {
        setLoading(false)
      }
    }

    fetchSimilar()
  }, [testResultId])

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Similar Failures in History
          </DialogTitle>
          {testName && (
            <p className="text-sm text-muted-foreground mt-1 truncate">{testName}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : similar.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium">No similar failures found</p>
            <p className="text-sm">
              This failure appears to be unique in the last 30 days.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
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
                      <Badge
                        variant="outline"
                        className={getSimilarityColor(failure.similarity)}
                      >
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
                        {formatDate(failure.createdAt)}
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
      </DialogContent>
    </Dialog>
  )
}
