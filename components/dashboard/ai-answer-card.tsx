"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Brain, Sparkles, X, Loader2, RefreshCw, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ============================================
// Types
// ============================================

export interface SearchResultForAI {
  testName: string
  testFile?: string | null
  status: string
  errorMessage?: string | null
  similarity?: number
}

interface AIAnswerCardProps {
  query: string
  searchResults: SearchResultForAI[]
  onClose: () => void
}

// ============================================
// Component
// ============================================

export function AIAnswerCard({ query, searchResults, onClose }: AIAnswerCardProps) {
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchAnswer = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setAnswer("")

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch("/api/search/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          searchResults: searchResults.map((r) => ({
            testName: r.testName,
            testFile: r.testFile,
            status: r.status,
            errorMessage: r.errorMessage,
            similarity: r.similarity,
          })),
          streaming: true,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to get AI answer")
      }

      // Check if streaming response
      const contentType = response.headers.get("content-type")
      if (contentType?.includes("text/event-stream")) {
        // Handle SSE stream
        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete events from buffer
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") {
                setIsLoading(false)
                return
              }
              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
                if (parsed.text) {
                  setAnswer((prev) => prev + parsed.text)
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } else {
        // Handle JSON response (non-streaming fallback)
        const data = await response.json()
        setAnswer(data.answer || "No answer generated")
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return // Request was cancelled, don't show error
      }
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [query, searchResults])

  useEffect(() => {
    fetchAnswer()

    return () => {
      // Cleanup: abort request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchAnswer])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail
    }
  }

  const handleRetry = () => {
    fetchAnswer()
  }

  return (
    <Card className="glass-card glass-card-glow border-cyan-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-cyan-400" />
            AI Analysis
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Gemini 2.0 Flash
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRetry}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopy}
                    disabled={!answer}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Q: {query}
        </p>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive text-sm">
            <p>Failed to generate answer: {error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleRetry}
            >
              Try Again
            </Button>
          </div>
        ) : isLoading && !answer ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analyzing {searchResults.length} test results...</span>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {answer}
              {isLoading && (
                <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse" />
              )}
            </div>
          </div>
        )}

        {/* Context info */}
        {searchResults.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
            Based on {searchResults.length} test result{searchResults.length !== 1 ? "s" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Ask AI Button Component
// ============================================

interface AskAIButtonProps {
  onClick: () => void
  disabled?: boolean
}

export function AskAIButton({ onClick, disabled }: AskAIButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className="gap-1.5 border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10"
          >
            <Brain className="h-4 w-4 text-cyan-400" />
            Ask AI
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Get AI analysis of these results</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
