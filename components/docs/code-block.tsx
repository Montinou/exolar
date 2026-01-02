"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeBlockProps {
  code: string
  title?: string
  className?: string
}

export function CodeBlock({ code, title, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("relative group", className)}>
      {title && (
        <div className="px-3 sm:px-4 py-2 bg-muted/50 border-b border-border rounded-t-lg text-xs text-muted-foreground font-mono truncate">
          {title}
        </div>
      )}
      <pre
        className={cn(
          "p-3 sm:p-4 bg-muted text-xs sm:text-sm overflow-x-auto",
          title ? "rounded-b-lg" : "rounded-lg"
        )}
      >
        <code>{code}</code>
      </pre>
      {/* Always visible on mobile (touch), hover on desktop */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md bg-background/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}
