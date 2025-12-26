# Phase 13: Real-Time Streaming

> **Priority:** Medium | **Complexity:** Medium | **Dependencies:** None
>
> Show live test results as they complete during execution.

---

## Objective

1. Implement Server-Sent Events (SSE) for real-time updates
2. Show live progress during running executions
3. Auto-refresh dashboard data
4. Display "live" indicator for running tests

---

## Prerequisites

- Basic dashboard implementation complete
- Understanding of SSE vs WebSockets

---

## Why SSE over WebSockets?

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client | Bidirectional |
| Complexity | Simple | More complex |
| Auto-reconnect | Built-in | Manual |
| HTTP/2 compatible | Yes | No |
| Vercel support | Yes (Edge) | Limited |

SSE is ideal for this use case: server pushes updates, client only receives.

---

## Database Changes

**No database migrations required** - uses existing data with polling.

---

## Backend Implementation

### 1. Create SSE Utilities (`lib/sse.ts`)

```typescript
/**
 * Create a Server-Sent Events stream
 */
export function createSSEStream(
  generator: () => AsyncGenerator<unknown>,
  signal?: AbortSignal
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = generator();

        for await (const data of gen) {
          if (signal?.aborted) {
            break;
          }

          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        }
      } catch (error) {
        console.error("SSE stream error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * Create a keep-alive heartbeat message
 */
export function createHeartbeat(): string {
  return `:heartbeat\n\n`;
}
```

### 2. Create Execution Stream API (`app/api/executions/[id]/stream/route.ts`)

```typescript
import { getExecutionById, getTestResultsByExecutionId } from "@/lib/db";
import { createSSEStream } from "@/lib/sse";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // or "edge" for Vercel Edge

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const executionId = parseInt(id);

  if (isNaN(executionId)) {
    return new Response("Invalid execution ID", { status: 400 });
  }

  async function* generateUpdates() {
    let lastResultCount = 0;
    let isComplete = false;
    const maxIterations = 300; // 5 minutes at 1s intervals
    let iterations = 0;

    while (!isComplete && iterations < maxIterations) {
      iterations++;

      try {
        // Get current execution state
        const execution = await getExecutionById(executionId);

        if (!execution) {
          yield { type: "error", message: "Execution not found" };
          break;
        }

        // Get test results
        const results = await getTestResultsByExecutionId(executionId);

        // Check if there are new results
        if (results.length !== lastResultCount) {
          lastResultCount = results.length;

          yield {
            type: "update",
            execution: {
              id: execution.id,
              status: execution.status,
              total_tests: execution.total_tests,
              passed: execution.passed,
              failed: execution.failed,
              skipped: execution.skipped,
              duration_ms: execution.duration_ms,
            },
            results: results.map((r) => ({
              id: r.id,
              test_name: r.test_name,
              test_file: r.test_file,
              status: r.status,
              duration_ms: r.duration_ms,
              error_message: r.error_message,
              is_flaky: r.is_flaky,
            })),
            timestamp: new Date().toISOString(),
          };
        }

        // Check if execution is complete
        if (execution.status !== "running") {
          isComplete = true;
          yield {
            type: "complete",
            execution,
            timestamp: new Date().toISOString(),
          };
          break;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Stream error:", error);
        yield {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        };
        break;
      }
    }
  }

  return createSSEStream(generateUpdates, request.signal);
}
```

### 3. Create Dashboard Stream API (`app/api/dashboard/stream/route.ts`)

```typescript
import { getDashboardMetrics, getExecutions } from "@/lib/db";
import { createSSEStream, createHeartbeat } from "@/lib/sse";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const interval = parseInt(searchParams.get("interval") || "5000"); // 5 seconds default

  async function* generateUpdates() {
    const maxIterations = 720; // 1 hour at 5s intervals
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      try {
        const [metrics, executions] = await Promise.all([
          getDashboardMetrics(),
          getExecutions(10), // Latest 10
        ]);

        // Check for running executions
        const runningExecutions = executions.filter(
          (e) => e.status === "running"
        );

        yield {
          type: "update",
          metrics,
          latestExecutions: executions.slice(0, 5),
          runningCount: runningExecutions.length,
          timestamp: new Date().toISOString(),
        };

        await new Promise((resolve) => setTimeout(resolve, interval));
      } catch (error) {
        console.error("Dashboard stream error:", error);
        // Send heartbeat on error to keep connection alive
        yield { type: "heartbeat" };
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
  }

  return createSSEStream(generateUpdates, request.signal);
}
```

---

## Frontend Implementation

### 1. Create SSE Hook (`hooks/use-sse.ts`)

```typescript
import { useEffect, useRef, useState, useCallback } from "react";

interface UseSSEOptions<T> {
  url: string;
  onMessage?: (data: T) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  enabled?: boolean;
  reconnectInterval?: number;
}

interface UseSSEReturn<T> {
  data: T | null;
  error: Event | null;
  isConnected: boolean;
  reconnect: () => void;
}

export function useSSE<T>({
  url,
  onMessage,
  onError,
  onOpen,
  enabled = true,
  reconnectInterval = 3000,
}: UseSSEOptions<T>): UseSSEReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Event | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as T;
        setData(parsed);
        onMessage?.(parsed);
      } catch (e) {
        console.error("Failed to parse SSE data:", e);
      }
    };

    eventSource.onerror = (e) => {
      setError(e);
      setIsConnected(false);
      onError?.(e);

      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);
    };
  }, [url, enabled, onMessage, onError, onOpen, reconnectInterval]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect();
  }, [connect]);

  return { data, error, isConnected, reconnect };
}
```

### 2. Create Live Execution View (`components/dashboard/live-execution.tsx`)

```tsx
"use client";

import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  AlertTriangle,
} from "lucide-react";

interface TestResult {
  id: number;
  test_name: string;
  test_file: string;
  status: string;
  duration_ms: number;
  is_flaky?: boolean;
}

interface ExecutionUpdate {
  type: "update" | "complete" | "error";
  execution?: {
    id: number;
    status: string;
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
  };
  results?: TestResult[];
  message?: string;
  timestamp: string;
}

interface LiveExecutionProps {
  executionId: number;
  onComplete?: () => void;
}

export function LiveExecution({ executionId, onComplete }: LiveExecutionProps) {
  const { data, isConnected } = useSSE<ExecutionUpdate>({
    url: `/api/executions/${executionId}/stream`,
    onMessage: (update) => {
      if (update.type === "complete") {
        onComplete?.();
      }
    },
  });

  if (!data?.execution) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Connecting to live stream...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { execution, results = [] } = data;
  const progress = execution.total_tests > 0
    ? ((execution.passed + execution.failed + execution.skipped) / execution.total_tests) * 100
    : 0;

  const isRunning = execution.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {isRunning ? (
              <>
                <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                Live Execution
              </>
            ) : (
              <>
                {execution.status === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Execution Complete
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Badge variant="outline" className="text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>
              {execution.passed + execution.failed + execution.skipped} / {execution.total_tests}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{execution.passed}</p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{execution.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-muted-foreground">{execution.skipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {execution.duration_ms
                ? `${(execution.duration_ms / 1000).toFixed(1)}s`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </div>
        </div>

        {/* Recent Results */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Results</h4>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {results.slice(-10).reverse().map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {result.status === "passed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : result.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{result.test_name}</span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {result.duration_ms}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. Create Live Indicator Component (`components/dashboard/live-indicator.tsx`)

```tsx
"use client";

import { useSSE } from "@/hooks/use-sse";
import { Badge } from "@/components/ui/badge";
import { Radio, Wifi, WifiOff } from "lucide-react";

interface DashboardUpdate {
  type: string;
  runningCount: number;
  timestamp: string;
}

export function LiveIndicator() {
  const { data, isConnected } = useSSE<DashboardUpdate>({
    url: "/api/dashboard/stream?interval=10000",
  });

  if (!isConnected) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <WifiOff className="h-3 w-3 mr-1" />
        Offline
      </Badge>
    );
  }

  const runningCount = data?.runningCount || 0;

  return (
    <div className="flex items-center gap-2">
      {runningCount > 0 && (
        <Badge variant="default" className="bg-green-500 animate-pulse">
          <Radio className="h-3 w-3 mr-1" />
          {runningCount} Running
        </Badge>
      )}
      <Badge variant="outline" className="text-green-600">
        <Wifi className="h-3 w-3 mr-1" />
        Live
      </Badge>
    </div>
  );
}
```

### 4. Add Live Components to Dashboard

```tsx
import { LiveIndicator } from "@/components/dashboard/live-indicator";
import { LiveExecution } from "@/components/dashboard/live-execution";

// In header:
<div className="flex items-center gap-4">
  <LiveIndicator />
  <UserMenu />
</div>

// Show live view for running executions:
{executions.some(e => e.status === "running") && (
  <LiveExecution
    executionId={executions.find(e => e.status === "running")!.id}
    onComplete={() => window.location.reload()}
  />
)}
```

---

## API Specification

### GET /api/executions/[id]/stream

SSE stream for execution progress.

**Response Events:**
```json
// Update event
{
  "type": "update",
  "execution": {
    "id": 123,
    "status": "running",
    "total_tests": 42,
    "passed": 20,
    "failed": 1,
    "skipped": 0
  },
  "results": [/* recent test results */],
  "timestamp": "2025-12-25T10:30:00Z"
}

// Complete event
{
  "type": "complete",
  "execution": {/* full execution data */},
  "timestamp": "2025-12-25T10:35:00Z"
}
```

### GET /api/dashboard/stream

SSE stream for dashboard updates.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| interval | number | 5000 | Update interval in ms |

**Response Events:**
```json
{
  "type": "update",
  "metrics": {/* dashboard metrics */},
  "latestExecutions": [/* recent executions */],
  "runningCount": 1,
  "timestamp": "2025-12-25T10:30:00Z"
}
```

---

## Testing Checklist

- [ ] SSE connection establishes
- [ ] Live execution shows progress
- [ ] Results update in real-time
- [ ] Connection reconnects on error
- [ ] Complete event fires when done
- [ ] Live indicator shows running count
- [ ] Dashboard refreshes with new data
- [ ] Memory doesn't leak with long connections

---

## Files to Create/Modify

### Create:
- `lib/sse.ts`
- `app/api/executions/[id]/stream/route.ts`
- `app/api/dashboard/stream/route.ts`
- `hooks/use-sse.ts`
- `components/dashboard/live-execution.tsx`
- `components/dashboard/live-indicator.tsx`

### Modify:
- `app/page.tsx` - Add LiveIndicator and LiveExecution

---

## Edge Runtime Consideration

For Vercel Edge Runtime (better for streaming):

```typescript
// app/api/executions/[id]/stream/route.ts
export const runtime = "edge";
```

Note: Edge runtime has limitations with database connections. May need to use HTTP polling instead of direct DB access.

---

*Phase 13 Complete → Proceed to Phase 14: Test Timeline Visualization*
