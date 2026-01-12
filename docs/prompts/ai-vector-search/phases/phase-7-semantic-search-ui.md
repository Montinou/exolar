# Phase 7: Semantic Search UI

> **Goal:** Upgrade search component with natural language support
> **Value Delivered:** Users can find tests by describing what they do
> **Dependencies:** Phase 6 (search API)
> **Estimated Steps:** 4

---

## Overview

This phase upgrades the search UI:
1. Enhance search input with mode selector
2. Add search result cards with similarity scores
3. Add autocomplete suggestions
4. Update existing search component

---

## Steps

### Step 7.1: Create Enhanced Search Component

**File:** `components/dashboard/semantic-search.tsx`

```typescript
"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Sparkles,
  Type,
  Blend,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { TestHistoryModal } from "./test-history-modal"

interface SemanticSearchResult {
  testSignature: string
  testName: string
  testFile: string
  similarity: number
  runCount: number
  lastStatus: string
  passRate: number
}

interface SemanticSearchProps {
  className?: string
  placeholder?: string
  onSelectTest?: (testSignature: string) => void
}

export function SemanticSearch({
  className,
  placeholder = "Search tests by name or describe what you're looking for...",
  onSelectTest,
}: SemanticSearchProps) {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<"hybrid" | "semantic" | "keyword">("hybrid")
  const [results, setResults] = useState<SemanticSearchResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)

  // History modal state
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)

  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch suggestions for short queries
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length < 2 || debouncedQuery.length > 10) {
        setSuggestions([])
        return
      }

      try {
        const response = await fetch(
          `/api/search/semantic?q=${encodeURIComponent(debouncedQuery)}&suggest=true`
        )
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error)
      }
    }

    fetchSuggestions()
  }, [debouncedQuery])

  // Fetch search results
  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.length < 2) {
        setResults([])
        setSearchTime(null)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/search/semantic?q=${encodeURIComponent(debouncedQuery)}&mode=${mode}&limit=10`
        )
        if (response.ok) {
          const data = await response.json()
          setResults(data.results || [])
          setSearchTime(data.searchTimeMs)
        }
      } catch (error) {
        console.error("Search failed:", error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    search()
  }, [debouncedQuery, mode])

  const handleSelectTest = useCallback(
    (testSignature: string) => {
      setSelectedTest(testSignature)
      setHistoryModalOpen(true)
      setOpen(false)
      onSelectTest?.(testSignature)
    },
    [onSelectTest]
  )

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setQuery(suggestion)
    inputRef.current?.focus()
  }, [])

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="pl-10 pr-4"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[500px] p-0" align="start">
          {/* Search mode selector */}
          <div className="flex items-center justify-between p-2 border-b">
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as typeof mode)}
              size="sm"
            >
              <ToggleGroupItem value="hybrid" className="text-xs">
                <Blend className="h-3 w-3 mr-1" />
                Smart
              </ToggleGroupItem>
              <ToggleGroupItem value="semantic" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Semantic
              </ToggleGroupItem>
              <ToggleGroupItem value="keyword" className="text-xs">
                <Type className="h-3 w-3 mr-1" />
                Keyword
              </ToggleGroupItem>
            </ToggleGroup>

            {searchTime !== null && (
              <span className="text-xs text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                {searchTime}ms
              </span>
            )}
          </div>

          <Command>
            <CommandList className="max-h-[400px]">
              {/* Suggestions */}
              {suggestions.length > 0 && query.length < 10 && (
                <CommandGroup heading="Suggestions">
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion}
                      onSelect={() => handleSelectSuggestion(suggestion)}
                      className="cursor-pointer"
                    >
                      <Search className="h-3 w-3 mr-2 text-muted-foreground" />
                      {suggestion}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Results */}
              {loading ? (
                <div className="p-2 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <CommandGroup heading={`Results (${results.length})`}>
                  {results.map((result) => (
                    <CommandItem
                      key={result.testSignature}
                      onSelect={() => handleSelectTest(result.testSignature)}
                      className="cursor-pointer py-2"
                    >
                      <SearchResultItem result={result} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : query.length >= 2 ? (
                <CommandEmpty>
                  <div className="text-center py-6">
                    <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>No tests found for "{query}"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try a different search term or mode
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm">Type to search tests</p>
                  <p className="text-xs mt-1">
                    Try: "checkout tests" or "verify payment flow"
                  </p>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Test History Modal */}
      <TestHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        testSignature={selectedTest}
      />
    </div>
  )
}

function SearchResultItem({ result }: { result: SemanticSearchResult }) {
  const similarityPercent = (result.similarity * 100).toFixed(0)
  const passRatePercent = result.passRate ? (result.passRate * 100).toFixed(0) : null

  return (
    <div className="flex items-start gap-3 w-full">
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {result.lastStatus === "passed" ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : result.lastStatus === "failed" ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : (
          <div className="h-4 w-4 rounded-full bg-muted" />
        )}
      </div>

      {/* Test info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{result.testName}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {similarityPercent}% match
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {result.testFile}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{result.runCount} runs</span>
          {passRatePercent && <span>{passRatePercent}% pass rate</span>}
        </div>
      </div>
    </div>
  )
}
```

**Verification:**
- [ ] File created at `components/dashboard/semantic-search.tsx`
- [ ] Mode selector (hybrid/semantic/keyword)
- [ ] Autocomplete suggestions
- [ ] Result cards with similarity scores

---

### Step 7.2: Create useDebounce Hook (if not exists)

**File:** `hooks/use-debounce.ts`

```typescript
import { useState, useEffect } from "react"

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

---

### Step 7.3: Integrate into Dashboard Header

**Modify:** Dashboard layout or header component to include the semantic search:

```typescript
import { SemanticSearch } from "@/components/dashboard/semantic-search"

// In dashboard header or layout:
<div className="flex items-center gap-4">
  <SemanticSearch className="w-96" />
  {/* ... other header elements */}
</div>
```

---

### Step 7.4: Install Required shadcn Components

```bash
npx shadcn@latest add command
npx shadcn@latest add popover
```

---

## Deliverables

| Item | Location | Status |
|------|----------|--------|
| Semantic search component | `components/dashboard/semantic-search.tsx` | ⬜ |
| useDebounce hook | `hooks/use-debounce.ts` | ⬜ |
| Dashboard integration | Dashboard header | ⬜ |
| shadcn components | package.json | ⬜ |

---

## Testing

**Manual Testing:**

1. Open dashboard
2. Click search input
3. Type "login" - verify keyword results appear
4. Type "tests that verify user authentication" - verify semantic results
5. Switch to "Semantic" mode and verify results change
6. Click a result and verify test history modal opens
7. Verify search time is displayed
8. Test autocomplete suggestions

**Example Queries to Test:**

| Query | Expected Behavior |
|-------|------------------|
| "login" | Keyword match on tests with "login" |
| "tests for checkout" | Semantic match on checkout-related tests |
| "API validation tests" | Finds tests in api/ folder |
| "tests that check payment flow" | Semantic match on payment tests |

---

## Next Phase

After completing Phase 7, proceed to [Phase 8: MCP Integration](./phase-8-mcp-integration.md).
