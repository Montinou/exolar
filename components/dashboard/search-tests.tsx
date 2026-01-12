"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Search, Loader2, FileCode, CheckCircle2, XCircle, Sparkles, Zap } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { TestHistoryModal } from "./test-history-modal"

// ============================================
// Types
// ============================================

type SearchMode = "hybrid" | "semantic" | "keyword"

interface TestSearchResult {
  test_signature: string
  test_name: string
  test_file: string
  run_count: number
  last_run: string
  last_status: string
  pass_rate: number
}

interface SemanticSearchResult {
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

interface SemanticSearchResponse {
  results: SemanticSearchResult[]
  query: string
  mode: SearchMode
  totalResults: number
  embeddingVersion?: "v1" | "v2"
  reranked: boolean
  searchTimeMs: number
}

// ============================================
// Props
// ============================================

interface SearchTestsProps {
  /** Enable semantic search mode selector */
  enableSemanticSearch?: boolean
  /** Default search mode */
  defaultMode?: SearchMode
  /** Placeholder text */
  placeholder?: string
}

// ============================================
// Component
// ============================================

export function SearchTests({
  enableSemanticSearch = true,
  defaultMode = "hybrid",
  placeholder = "Search tests...",
}: SearchTestsProps) {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<SearchMode>(defaultMode)
  const [results, setResults] = useState<TestSearchResult[]>([])
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [searchMeta, setSearchMeta] = useState<{
    reranked: boolean
    embeddingVersion?: string
    searchTimeMs: number
  } | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  // Keyword search (original)
  const searchKeyword = useCallback(async (searchQuery: string) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
    const data = await response.json()
    return data.tests || []
  }, [])

  // Semantic search (new)
  const searchSemantic = useCallback(async (searchQuery: string, searchMode: SearchMode) => {
    const response = await fetch("/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: searchQuery,
        mode: searchMode,
        limit: 20,
        rerank: true,
      }),
    })
    const data: SemanticSearchResponse = await response.json()
    return data
  }, [])

  // Main search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setSemanticResults([])
      setSearchMeta(null)
      return
    }

    setIsLoading(true)
    try {
      if (mode === "keyword") {
        // Keyword-only mode
        const keywordResults = await searchKeyword(searchQuery)
        setResults(keywordResults)
        setSemanticResults([])
        setSearchMeta(null)
      } else {
        // Semantic or hybrid mode
        const semanticData = await searchSemantic(searchQuery, mode)
        setSemanticResults(semanticData.results)
        setResults([])
        setSearchMeta({
          reranked: semanticData.reranked,
          embeddingVersion: semanticData.embeddingVersion,
          searchTimeMs: semanticData.searchTimeMs,
        })
      }
    } catch (error) {
      console.error("Search failed:", error)
      setResults([])
      setSemanticResults([])
      setSearchMeta(null)
    } finally {
      setIsLoading(false)
    }
  }, [mode, searchKeyword, searchSemantic])

  useEffect(() => {
    performSearch(debouncedQuery)
  }, [debouncedQuery, performSearch])

  const handleSelect = (signature: string | null) => {
    if (signature) {
      setSelectedTest(signature)
    }
    setIsOpen(false)
    setQuery("")
  }

  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}%`
  }

  const hasResults = results.length > 0 || semanticResults.length > 0

  return (
    <>
      <div className="relative w-full max-w-md">
        {/* Search Input Row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              className="pl-10 pr-10"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Mode Selector */}
          {enableSemanticSearch && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hybrid">
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Hybrid
                          </span>
                        </SelectItem>
                        <SelectItem value="semantic">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            AI
                          </span>
                        </SelectItem>
                        <SelectItem value="keyword">
                          <span className="flex items-center gap-1">
                            <Search className="h-3 w-3" />
                            Keyword
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {mode === "hybrid" && "AI + keyword search combined"}
                    {mode === "semantic" && "AI-powered semantic search"}
                    {mode === "keyword" && "Traditional text matching"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Results Dropdown */}
        {isOpen && hasResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {/* Search Meta Info */}
            {searchMeta && (
              <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
                {searchMeta.reranked && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    Reranked
                  </Badge>
                )}
                {searchMeta.embeddingVersion && (
                  <span>v{searchMeta.embeddingVersion.replace("v", "")}</span>
                )}
                <span>{searchMeta.searchTimeMs}ms</span>
              </div>
            )}

            {/* Keyword Results */}
            {results.map((result) => (
              <button
                key={result.test_signature}
                onClick={() => handleSelect(result.test_signature)}
                className="w-full px-4 py-3 hover:bg-muted text-left border-b last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.test_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileCode className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{result.test_file}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-shrink-0">
                    {result.last_status === "passed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-muted-foreground">{result.run_count} runs</span>
                    <span className="text-muted-foreground">{result.pass_rate}%</span>
                  </div>
                </div>
              </button>
            ))}

            {/* Semantic Results */}
            {semanticResults.map((result, index) => (
              <button
                key={`${result.testResultId}-${index}`}
                onClick={() => handleSelect(result.testSignature)}
                className="w-full px-4 py-3 hover:bg-muted text-left border-b last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.testName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileCode className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{result.testFile}</span>
                    </p>
                    {result.errorMessage && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {result.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {result.status === "passed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge
                        variant={result.similarity > 0.8 ? "default" : "secondary"}
                        className="text-[10px] px-1.5"
                      >
                        {formatSimilarity(result.similarity)}
                      </Badge>
                    </div>
                    {result.branch && (
                      <span className="text-xs text-muted-foreground">{result.branch}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {isOpen && query.length >= 2 && !hasResults && !isLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-4 text-center text-muted-foreground">
            No tests found matching &quot;{query}&quot;
          </div>
        )}
      </div>

      {selectedTest && (
        <TestHistoryModal signature={selectedTest} onClose={() => setSelectedTest(null)} />
      )}
    </>
  )
}
