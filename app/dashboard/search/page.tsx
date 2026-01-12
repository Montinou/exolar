"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Sparkles,
  Zap,
  ExternalLink,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
} from "lucide-react"

type SearchMode = "hybrid" | "semantic" | "keyword"

interface SearchResult {
  testResultId: number
  executionId: number
  testName: string
  testFile: string
  testSignature: string | null
  status: string
  errorMessage: string | null
  similarity: number
  branch: string
  suite: string | null
  createdAt: string
}

interface SearchResponse {
  results: SearchResult[]
  query: string
  mode: SearchMode
  totalResults: number
  embeddingVersion?: "v1" | "v2"
  reranked: boolean
  searchTimeMs: number
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<SearchMode>("hybrid")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [meta, setMeta] = useState<{
    totalResults: number
    reranked: boolean
    searchTimeMs: number
    embeddingVersion?: string
  } | null>(null)

  const performSearch = useCallback(async () => {
    if (query.trim().length < 2) return

    setIsLoading(true)
    setSearched(true)
    try {
      const response = await fetch("/api/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          mode,
          limit: 50,
          rerank: true,
        }),
      })
      if (response.ok) {
        const data: SearchResponse = await response.json()
        setResults(data.results)
        setMeta({
          totalResults: data.totalResults,
          reranked: data.reranked,
          searchTimeMs: data.searchTimeMs,
          embeddingVersion: data.embeddingVersion,
        })
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsLoading(false)
    }
  }, [query, mode])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      performSearch()
    }
  }

  const exportResults = () => {
    const csv = [
      ["Test Name", "File", "Status", "Branch", "Suite", "Similarity", "Error", "Date"],
      ...results.map((r) => [
        r.testName,
        r.testFile,
        r.status,
        r.branch,
        r.suite || "",
        `${Math.round(r.similarity * 100)}%`,
        r.errorMessage?.substring(0, 100) || "",
        new Date(r.createdAt).toISOString(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `search-${query.replace(/\s+/g, "-")}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Page Title and Search Bar */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            Semantic Search
          </h1>
          <p className="text-sm text-muted-foreground">
            Search failures by intent using AI-powered semantic matching
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search failures... e.g., 'timeout errors', 'login failures', 'API rate limiting'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 h-12 text-lg"
            />
          </div>
          <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
            <SelectTrigger className="w-[140px] h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Hybrid
                </span>
              </SelectItem>
              <SelectItem value="semantic">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Only
                </span>
              </SelectItem>
              <SelectItem value="keyword">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Keyword
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={performSearch} disabled={query.length < 2 || isLoading} className="h-12 px-8">
            {isLoading ? <Clock className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      {/* Results */}
        {/* Meta Info */}
        {meta && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{meta.totalResults} results</span>
              <span>•</span>
              <span>{meta.searchTimeMs}ms</span>
              {meta.reranked && (
                <>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Reranked
                  </Badge>
                </>
              )}
              {meta.embeddingVersion && (
                <>
                  <span>•</span>
                  <span>v{meta.embeddingVersion.replace("v", "")}</span>
                </>
              )}
            </div>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportResults}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Results Table */}
        {!isLoading && results.length > 0 && (
          <div className="glass-card glass-card-glow rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Status</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead className="w-[120px]">Branch</TableHead>
                  <TableHead className="w-[100px]">Relevance</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={`${result.testResultId}-${index}`}>
                    <TableCell>
                      {result.status === "passed" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium truncate max-w-[400px]" title={result.testName}>
                          {result.testName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                          {result.testFile}
                        </p>
                        {result.errorMessage && (
                          <p className="text-xs text-muted-foreground truncate max-w-[400px] font-mono">
                            {result.errorMessage}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <GitBranch className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[100px]">{result.branch}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={result.similarity >= 0.8 ? "default" : "secondary"}
                        className="font-mono"
                      >
                        {Math.round(result.similarity * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(result.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/executions/${result.executionId}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && searched && results.length === 0 && (
          <div className="glass-card glass-card-glow p-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm text-muted-foreground">Try a different search term or mode</p>
          </div>
        )}

        {/* Initial State */}
        {!searched && (
          <div className="glass-card glass-card-glow p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-cyan-400" />
            <p className="text-lg font-medium">AI-Powered Failure Search</p>
            <p className="text-sm text-muted-foreground mb-6">
              Search by error type, behavior, or description — not just keywords
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["timeout errors", "login failures", "API rate limiting", "flaky tests", "network issues"].map((example) => (
                <Badge
                  key={example}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => {
                    setQuery(example)
                    setTimeout(performSearch, 100)
                  }}
                >
                  {example}
                </Badge>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
