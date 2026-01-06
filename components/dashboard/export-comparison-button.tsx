"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Download,
  ChevronDown,
  FileText,
  FileJson,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react"
import type { ComparisonResult } from "@/lib/types"
import {
  comparisonToMarkdown,
  comparisonToJSON,
  downloadFile,
  copyToClipboard,
} from "@/lib/export-comparison"

interface ExportComparisonButtonProps {
  /** The comparison result to export */
  comparison: ComparisonResult
}

type CopyState = "idle" | "copying" | "success" | "error"

export function ExportComparisonButton({ comparison }: ExportComparisonButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copyState, setCopyState] = useState<{ md: CopyState; json: CopyState }>({
    md: "idle",
    json: "idle",
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const resetCopyState = useCallback((format: "md" | "json") => {
    timeoutRef.current = setTimeout(() => {
      setCopyState((prev) => ({ ...prev, [format]: "idle" }))
    }, 2000)
  }, [])

  const handleExportMarkdown = useCallback(() => {
    const md = comparisonToMarkdown(comparison)
    const filename = `comparison-${comparison.baseline.commitSha.slice(0, 7)}-vs-${comparison.current.commitSha.slice(0, 7)}.md`
    downloadFile(md, filename, "text/markdown;charset=utf-8")
    setIsOpen(false)
  }, [comparison])

  const handleExportJSON = useCallback(() => {
    const json = comparisonToJSON(comparison)
    const filename = `comparison-${comparison.baseline.commitSha.slice(0, 7)}-vs-${comparison.current.commitSha.slice(0, 7)}.json`
    downloadFile(json, filename, "application/json;charset=utf-8")
    setIsOpen(false)
  }, [comparison])

  const handleCopyMarkdown = useCallback(async () => {
    setCopyState((prev) => ({ ...prev, md: "copying" }))
    const md = comparisonToMarkdown(comparison)
    const success = await copyToClipboard(md)
    setCopyState((prev) => ({ ...prev, md: success ? "success" : "error" }))
    resetCopyState("md")
  }, [comparison, resetCopyState])

  const handleCopyJSON = useCallback(async () => {
    setCopyState((prev) => ({ ...prev, json: "copying" }))
    const json = comparisonToJSON(comparison)
    const success = await copyToClipboard(json)
    setCopyState((prev) => ({ ...prev, json: success ? "success" : "error" }))
    resetCopyState("json")
  }, [comparison, resetCopyState])

  const getCopyIcon = (state: CopyState) => {
    switch (state) {
      case "success":
        return <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
      default:
        return <Copy className="h-4 w-4" aria-hidden="true" />
    }
  }

  const getCopyText = (state: CopyState, format: string) => {
    switch (state) {
      case "copying":
        return "Copying..."
      case "success":
        return "Copied!"
      case "error":
        return "Failed to copy"
      default:
        return `Copy as ${format}`
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
        <ChevronDown 
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} 
          aria-hidden="true" 
        />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-background shadow-lg"
          role="menu"
          aria-label="Export options"
        >
          <div className="p-1">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Download
            </p>
            <button
              onClick={handleExportMarkdown}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Markdown (.md)
            </button>
            <button
              onClick={handleExportJSON}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <FileJson className="h-4 w-4" aria-hidden="true" />
              JSON (.json)
            </button>
          </div>
          
          <div className="border-t border-border/50 p-1">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Copy to Clipboard
            </p>
            <button
              onClick={handleCopyMarkdown}
              role="menuitem"
              disabled={copyState.md === "copying"}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {getCopyIcon(copyState.md)}
              {getCopyText(copyState.md, "Markdown")}
            </button>
            <button
              onClick={handleCopyJSON}
              role="menuitem"
              disabled={copyState.json === "copying"}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {getCopyIcon(copyState.json)}
              {getCopyText(copyState.json, "JSON")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
