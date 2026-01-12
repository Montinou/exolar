"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ChevronDown,
  ChevronRight,
  Layers,
  AlertCircle,
  FileText,
  Sparkles
} from "lucide-react"

// ============================================
// Types
// ============================================

export interface ClusterTest {
  testResultId: number
  testName: string
  testFile: string
  errorMessage: string | null
  distanceToCentroid: number
  isRepresentative: boolean
}

export interface FailureCluster {
  clusterId: number
  representativeError: string
  testCount: number
  tests: ClusterTest[]
}

interface FailureClusterCardProps {
  cluster: FailureCluster
  onTestClick?: (testResultId: number) => void
  onFindSimilar?: (testResultId: number) => void
}

// ============================================
// Helper Functions
// ============================================

function truncateError(error: string, maxLength: number = 150): string {
  if (error.length <= maxLength) return error
  return error.substring(0, maxLength) + "..."
}

function getSimilarityPercent(distance: number): number {
  return Math.round((1 - distance) * 100)
}

function getSimilarityColor(distance: number): string {
  const similarity = 1 - distance
  if (similarity >= 0.95) return "text-green-500"
  if (similarity >= 0.85) return "text-yellow-500"
  return "text-orange-500"
}

// ============================================
// Failure Cluster Card Component
// ============================================

export function FailureClusterCard({
  cluster,
  onTestClick,
  onFindSimilar
}: FailureClusterCardProps) {
  const [isOpen, setIsOpen] = useState(cluster.testCount <= 5)

  const representative = cluster.tests.find(t => t.isRepresentative) || cluster.tests[0]

  return (
    <div className="glass-card p-4 space-y-3 status-border-error">
      {/* Cluster Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-destructive/10 shrink-0">
            <Layers className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Cluster #{cluster.clusterId}</span>
              <Badge variant="secondary" className="text-xs">
                {cluster.testCount} test{cluster.testCount !== 1 ? "s" : ""}
              </Badge>
              {cluster.testCount > 1 && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/30">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Grouped
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={cluster.representativeError}>
              {truncateError(cluster.representativeError)}
            </p>
          </div>
        </div>
      </div>

      {/* Representative Test */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span className="font-medium">Representative Failure</span>
        </div>
        <div className="space-y-1">
          <p
            className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
            onClick={() => onTestClick?.(representative.testResultId)}
          >
            {representative.testName}
          </p>
          <p className="text-xs text-muted-foreground">{representative.testFile}</p>
        </div>
        {representative.errorMessage && (
          <div className="bg-destructive/10 rounded p-2 mt-2">
            <p className="text-xs font-mono text-destructive/90 line-clamp-3">
              {representative.errorMessage}
            </p>
          </div>
        )}
        {onFindSimilar && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs mt-2"
            onClick={() => onFindSimilar(representative.testResultId)}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Find Similar in History
          </Button>
        )}
      </div>

      {/* Other Tests in Cluster */}
      {cluster.testCount > 1 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground w-full justify-start"
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {cluster.testCount - 1} similar failure{cluster.testCount > 2 ? "s" : ""} in this cluster
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {cluster.tests
              .filter(t => !t.isRepresentative)
              .map((test) => (
                <div
                  key={test.testResultId}
                  className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => onTestClick?.(test.testResultId)}
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{test.testName}</p>
                    <p className="text-xs text-muted-foreground truncate">{test.testFile}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium ${getSimilarityColor(test.distanceToCentroid)}`}>
                      {getSimilarityPercent(test.distanceToCentroid)}% match
                    </span>
                  </div>
                </div>
              ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
