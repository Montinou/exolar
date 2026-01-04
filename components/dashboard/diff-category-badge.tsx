"use client"

import {
  XCircle,
  CheckCircle2,
  Plus,
  Minus,
  CircleDot,
} from "lucide-react"
import type { TestDiffCategory } from "@/lib/types"

const DIFF_CONFIG: Record<
  TestDiffCategory,
  { label: string; icon: React.ElementType; className: string }
> = {
  new_failure: {
    label: "New Failure",
    icon: XCircle,
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  fixed: {
    label: "Fixed",
    icon: CheckCircle2,
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  new_test: {
    label: "New Test",
    icon: Plus,
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  removed_test: {
    label: "Removed",
    icon: Minus,
    className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
  unchanged: {
    label: "Unchanged",
    icon: CircleDot,
    className: "bg-muted/30 text-muted-foreground border-muted/50",
  },
}

interface DiffCategoryBadgeProps {
  category: TestDiffCategory
  showIcon?: boolean
  size?: "sm" | "md"
}

export function DiffCategoryBadge({
  category,
  showIcon = true,
  size = "sm",
}: DiffCategoryBadgeProps) {
  const config = DIFF_CONFIG[category]
  const Icon = config.icon

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.className} ${sizeClasses}`}
    >
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />}
      {config.label}
    </span>
  )
}

export function getDiffCategoryColor(category: TestDiffCategory): string {
  return DIFF_CONFIG[category].className
}
