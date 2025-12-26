"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Search, Loader2, FileCode, CheckCircle2, XCircle } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { TestHistoryModal } from "./test-history-modal"

interface TestSearchResult {
  test_signature: string
  test_name: string
  test_file: string
  run_count: number
  last_run: string
  last_status: string
  pass_rate: number
}

export function SearchTests() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TestSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  const searchTests = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setResults(data.tests || [])
    } catch (error) {
      console.error("Search failed:", error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    searchTests(debouncedQuery)
  }, [debouncedQuery, searchTests])

  const handleSelect = (signature: string) => {
    setSelectedTest(signature)
    setIsOpen(false)
    setQuery("")
  }

  return (
    <>
      <div className="relative w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tests by name or file..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-10"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {isOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
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
          </div>
        )}

        {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-4 text-center text-muted-foreground">
            No tests found matching &quot;{query}&quot;
          </div>
        )}
      </div>

      {selectedTest && <TestHistoryModal signature={selectedTest} onClose={() => setSelectedTest(null)} />}
    </>
  )
}
