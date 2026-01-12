# Phase 4: Clustering UI

> **Goal:** Add smart grouping toggle and cluster visualization to dashboard
> **Value Delivered:** Users can view failures grouped by root cause
> **Dependencies:** Phase 3 (clustering API)
> **Estimated Steps:** 6

---

## Overview

This phase adds the UI for failure clustering:
1. Add "Smart Grouping" toggle to execution detail page
2. Create cluster card component
3. Create clustered view component
4. Add cluster expansion/collapse
5. Add "Similar Failures" modal

---

## Steps

### Step 4.1: Create Cluster Card Component

**File:** `components/dashboard/failure-cluster-card.tsx`

```typescript
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Layers,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TestResultCard } from "./test-result-card"
import type { FailureCluster, ClusterMember } from "@/lib/ai/types"

interface FailureClusterCardProps {
  cluster: FailureCluster
  executionId: number
  onViewSimilar?: (testResultId: number) => void
  defaultExpanded?: boolean
}

export function FailureClusterCard({
  cluster,
  executionId,
  onViewSimilar,
  defaultExpanded = false,
}: FailureClusterCardProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded)

  // Find the representative test (closest to centroid)
  const representative = cluster.tests.find((t) => t.isRepresentative) || cluster.tests[0]

  return (
    <Card className="border-l-4 border-l-red-500">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-base font-medium">
                    Cluster {cluster.clusterId}
                  </CardTitle>
                </div>
                <Badge variant="destructive" className="font-mono">
                  {cluster.testCount} {cluster.testCount === 1 ? "failure" : "failures"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {onViewSimilar && representative && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewSimilar(representative.testResultId)
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    History
                  </Button>
                )}
              </div>
            </div>

            {/* Representative error preview */}
            <div className="mt-2 ml-8">
              <p className="text-sm text-muted-foreground line-clamp-2 font-mono">
                {truncateError(cluster.representativeError, 150)}
              </p>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Cluster summary */}
            <div className="mb-4 p-3 bg-muted/30 rounded-lg flex items-center gap-4 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>
                These <strong>{cluster.testCount}</strong> tests failed with
                semantically similar errors
              </span>
            </div>

            {/* Member tests */}
            <div className="space-y-3">
              {cluster.tests.map((member, index) => (
                <ClusterMemberItem
                  key={member.testResultId}
                  member={member}
                  index={index}
                  isRepresentative={member.isRepresentative}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

/**
 * Individual cluster member item
 */
function ClusterMemberItem({
  member,
  index,
  isRepresentative,
}: {
  member: ClusterMember
  index: number
  isRepresentative: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isRepresentative && "border-amber-500/50 bg-amber-500/5"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground font-mono">
            #{index + 1}
          </span>
          {isRepresentative && (
            <Badge variant="outline" className="text-xs">
              Representative
            </Badge>
          )}
          <span className="font-medium truncate">{member.testName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {(member.distanceToCentroid * 100).toFixed(1)}% distance
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Less" : "More"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1 truncate">
        {member.testFile}
      </p>

      {expanded && member.errorMessage && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono whitespace-pre-wrap">
          {member.errorMessage}
        </div>
      )}
    </div>
  )
}

function truncateError(error: string, maxLength: number): string {
  if (error.length <= maxLength) return error
  return error.substring(0, maxLength) + "..."
}
```

**Verification:**
- [ ] File created at `components/dashboard/failure-cluster-card.tsx`
- [ ] Collapsible cluster with member list
- [ ] Representative failure highlighted

---

### Step 4.2: Create Clustered View Component

**File:** `components/dashboard/clustered-failures-view.tsx`

```typescript
"use client"

import { useState, useEffect } from "react"
import { FailureClusterCard } from "./failure-cluster-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Layers, AlertTriangle } from "lucide-react"
import type { FailureCluster } from "@/lib/ai/types"

interface ClusteredFailuresViewProps {
  executionId: number
  onViewSimilar?: (testResultId: number) => void
}

interface ClustersResponse {
  clusters: FailureCluster[]
  metadata: {
    totalClusters: number
    totalFailures: number
    generated: string
  }
}

export function ClusteredFailuresView({
  executionId,
  onViewSimilar,
}: ClusteredFailuresViewProps) {
  const [data, setData] = useState<ClustersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchClusters = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true)
      else setLoading(true)

      const url = `/api/executions/${executionId}/clusters${forceRefresh ? "?refresh=true" : ""}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to load clusters")
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchClusters()
  }, [executionId])

  if (loading) {
    return <ClusteredFailuresViewSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button
            variant="link"
            size="sm"
            onClick={() => fetchClusters()}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.clusters.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No failure clusters found.</p>
        <p className="text-sm mt-1">
          Failures need embeddings to be clustered. Check if embeddings have been generated.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>
            {data.metadata.totalFailures} failures grouped into{" "}
            <strong>{data.metadata.totalClusters}</strong> clusters
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchClusters(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Cluster cards */}
      <div className="space-y-4">
        {data.clusters.map((cluster) => (
          <FailureClusterCard
            key={cluster.clusterId}
            cluster={cluster}
            executionId={executionId}
            onViewSimilar={onViewSimilar}
            defaultExpanded={cluster.testCount <= 5}
          />
        ))}
      </div>
    </div>
  )
}

function ClusteredFailuresViewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  )
}
```

**Verification:**
- [ ] File created at `components/dashboard/clustered-failures-view.tsx`
- [ ] Fetches from clustering API
- [ ] Loading and error states

---

### Step 4.3: Add View Toggle to Execution Page

**Modify:** `app/dashboard/executions/[id]/page.tsx`

Add a toggle between "List View" and "Clustered View":

```typescript
// Add imports
import { ClusteredFailuresView } from "@/components/dashboard/clustered-failures-view"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { List, Layers } from "lucide-react"

// In the component, add state for view mode
const [viewMode, setViewMode] = useState<"list" | "clustered">("list")

// In the Test Results card, add toggle above tabs:
<div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-semibold">Test Results</h3>

  {/* View mode toggle */}
  <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "list" | "clustered")}>
    <ToggleGroupItem value="list" aria-label="List view">
      <List className="h-4 w-4 mr-1" />
      List
    </ToggleGroupItem>
    <ToggleGroupItem value="clustered" aria-label="Clustered view">
      <Layers className="h-4 w-4 mr-1" />
      Smart Groups
    </ToggleGroupItem>
  </ToggleGroup>
</div>

{/* Conditional rendering based on view mode */}
{viewMode === "list" ? (
  <Tabs defaultValue="failed">
    {/* Existing tabs with Failed/Passed/Skipped */}
  </Tabs>
) : (
  <ClusteredFailuresView
    executionId={execution.id}
    onViewSimilar={(testResultId) => {
      // Open similar failures modal
      setSelectedTestForSimilar(testResultId)
      setSimilarModalOpen(true)
    }}
  />
)}
```

**Full integration example:**

```typescript
"use client"

import { useState } from "react"
// ... other imports

export default function ExecutionDetailPage({ params }: { params: { id: string } }) {
  const [viewMode, setViewMode] = useState<"list" | "clustered">("list")
  const [similarModalOpen, setSimilarModalOpen] = useState(false)
  const [selectedTestForSimilar, setSelectedTestForSimilar] = useState<number | null>(null)

  // ... existing data fetching ...

  return (
    <div className="container mx-auto py-6">
      {/* ... header and summary cards ... */}

      {/* Test Results Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Test Results</CardTitle>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as "list" | "clustered")}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem
                value="list"
                aria-label="List view"
                className="data-[state=on]:bg-background"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </ToggleGroupItem>
              <ToggleGroupItem
                value="clustered"
                aria-label="Clustered view"
                className="data-[state=on]:bg-background"
              >
                <Layers className="h-4 w-4 mr-1" />
                Smart Groups
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            <Tabs defaultValue="failed">
              {/* ... existing tabs implementation ... */}
            </Tabs>
          ) : (
            <ClusteredFailuresView
              executionId={parseInt(params.id)}
              onViewSimilar={(testResultId) => {
                setSelectedTestForSimilar(testResultId)
                setSimilarModalOpen(true)
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Similar Failures Modal */}
      <SimilarFailuresModal
        open={similarModalOpen}
        onOpenChange={setSimilarModalOpen}
        testResultId={selectedTestForSimilar}
      />
    </div>
  )
}
```

**Verification:**
- [ ] Toggle added to execution detail page
- [ ] Switches between list and clustered view
- [ ] State persists during page interactions

---

### Step 4.4: Create Similar Failures Modal

**File:** `components/dashboard/similar-failures-modal.tsx`

```typescript
"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, History, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface SimilarFailuresModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testResultId: number | null
}

interface SimilarFailure {
  executionId: number
  testResultId: number
  testName: string
  errorMessage: string | null
  similarity: number
  createdAt: string
  branch: string
}

export function SimilarFailuresModal({
  open,
  onOpenChange,
  testResultId,
}: SimilarFailuresModalProps) {
  const [loading, setLoading] = useState(true)
  const [similar, setSimilar] = useState<SimilarFailure[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !testResultId) return

    const fetchSimilar = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/failures/${testResultId}/similar?limit=10&days=30`)

        if (!response.ok) {
          throw new Error("Failed to fetch similar failures")
        }

        const data = await response.json()
        setSimilar(data.similar)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchSimilar()
  }, [open, testResultId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Similar Historical Failures
          </DialogTitle>
          <DialogDescription>
            Failures from the past 30 days with similar error patterns
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : similar.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No similar historical failures found</p>
              <p className="text-sm mt-1">
                This could be a new type of failure!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {similar.map((failure) => (
                <SimilarFailureCard key={failure.testResultId} failure={failure} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SimilarFailureCard({ failure }: { failure: SimilarFailure }) {
  const similarityPercent = (failure.similarity * 100).toFixed(0)

  return (
    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              failure.similarity > 0.9
                ? "destructive"
                : failure.similarity > 0.7
                  ? "secondary"
                  : "outline"
            }
          >
            {similarityPercent}% similar
          </Badge>
          <span className="text-sm text-muted-foreground">
            on <strong>{failure.branch}</strong>
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(failure.createdAt), { addSuffix: true })}
        </span>
      </div>

      <h4 className="font-medium truncate">{failure.testName}</h4>

      {failure.errorMessage && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 font-mono">
          {failure.errorMessage}
        </p>
      )}

      <div className="mt-2">
        <Button variant="link" size="sm" className="h-auto p-0" asChild>
          <a href={`/dashboard/executions/${failure.executionId}`} target="_blank">
            View Execution
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </div>
    </div>
  )
}
```

**Verification:**
- [ ] File created at `components/dashboard/similar-failures-modal.tsx`
- [ ] Shows historical similar failures
- [ ] Links to execution page

---

### Step 4.5: Add UI Exports

**Modify:** `components/dashboard/index.ts` (if exists, or create)

```typescript
// Add exports for new components
export { FailureClusterCard } from "./failure-cluster-card"
export { ClusteredFailuresView } from "./clustered-failures-view"
export { SimilarFailuresModal } from "./similar-failures-modal"
```

---

### Step 4.6: Install Required shadcn Components

Make sure these shadcn components are installed:

```bash
npx shadcn@latest add collapsible
npx shadcn@latest add toggle-group
npx shadcn@latest add dialog
npx shadcn@latest add skeleton
npx shadcn@latest add alert
```

**Verification:**
- [ ] All required shadcn components installed

---

## Deliverables

| Item | Location | Status |
|------|----------|--------|
| Cluster card component | `components/dashboard/failure-cluster-card.tsx` | ⬜ |
| Clustered view component | `components/dashboard/clustered-failures-view.tsx` | ⬜ |
| View toggle integration | `app/dashboard/executions/[id]/page.tsx` | ⬜ |
| Similar failures modal | `components/dashboard/similar-failures-modal.tsx` | ⬜ |
| Component exports | `components/dashboard/index.ts` | ⬜ |
| shadcn components | package.json | ⬜ |

---

## Testing

**1. Visual Testing:**

1. Navigate to an execution with failures
2. Verify toggle appears next to "Test Results" title
3. Click "Smart Groups" toggle
4. Verify clusters are displayed
5. Expand a cluster and verify member tests appear
6. Click "History" button and verify modal opens

**2. Edge Cases:**

- [ ] Execution with no failures shows empty state
- [ ] Execution with failures but no embeddings shows message
- [ ] Single-failure clusters display correctly
- [ ] Large clusters (50+ tests) load efficiently
- [ ] Modal handles no similar failures gracefully

---

## Screenshots/Mockups

**Toggle UI:**
```
┌────────────────────────────────────────────────┐
│ Test Results                    [List] [Smart] │
├────────────────────────────────────────────────┤
```

**Cluster Card (Collapsed):**
```
┌────────────────────────────────────────────────┐
│ > 🟥 Cluster 1           [15 failures] [History]│
│   TimeoutError: Navigation timeout exceeded... │
└────────────────────────────────────────────────┘
```

**Cluster Card (Expanded):**
```
┌────────────────────────────────────────────────┐
│ v 🟥 Cluster 1           [15 failures] [History]│
│   TimeoutError: Navigation timeout exceeded... │
│                                                │
│ ℹ️ These 15 tests failed with similar errors  │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ #1 [Representative] Login test          │  │
│ │ auth.spec.ts            2.3% distance   │  │
│ └──────────────────────────────────────────┘  │
│ ┌──────────────────────────────────────────┐  │
│ │ #2 Signup test                           │  │
│ │ auth.spec.ts            4.1% distance   │  │
│ └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

---

## Next Phase

After completing Phase 4, proceed to [Phase 5: Batch Indexing](./phase-5-batch-indexing.md) to index existing tests for semantic search.
