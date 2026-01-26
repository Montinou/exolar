"use client"

/**
 * Test Relevance Badge Component
 * Displays relevance score/label for a test with optional tooltip
 */

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import type { RelevanceLabel } from "@/lib/db"

interface TestRelevanceBadgeProps {
  score: number
  label?: RelevanceLabel | null
  showScore?: boolean
  showTooltip?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * Get display properties for a relevance score/label
 */
function getRelevanceDisplay(score: number, label?: RelevanceLabel | null) {
  // Use manual label if set, otherwise derive from score
  const effectiveLabel = label || scoreToLabel(score)

  const config = {
    critical: {
      label: "Critical",
      color: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
      description: "Critical business flow - highest priority",
    },
    high: {
      label: "High",
      color: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
      description: "Important test - high priority",
    },
    medium: {
      label: "Medium",
      color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
      description: "Standard priority test",
    },
    low: {
      label: "Low",
      color: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
      description: "Lower priority test",
    },
    ignore: {
      label: "Ignore",
      color: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30",
      description: "Deprioritized or disabled",
    },
  }

  return config[effectiveLabel] || config.medium
}

/**
 * Convert score to label
 */
function scoreToLabel(score: number): RelevanceLabel {
  if (score >= 90) return "critical"
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  if (score >= 10) return "low"
  return "ignore"
}

export function TestRelevanceBadge({
  score,
  label,
  showScore = false,
  showTooltip = true,
  size = "sm",
  className,
}: TestRelevanceBadgeProps) {
  const display = getRelevanceDisplay(score, label)

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-0.5",
    lg: "text-base px-2.5 py-1",
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        display.color,
        sizeClasses[size],
        "font-medium",
        label && "ring-1 ring-offset-1 ring-offset-background",
        className
      )}
    >
      {showScore ? `${display.label} (${score})` : display.label}
      {label && (
        <span className="ml-1 opacity-60" title="Manual override">
          *
        </span>
      )}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{display.description}</p>
            <p className="text-xs text-muted-foreground">
              Score: {score}/100
              {label && " (manually set)"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact score indicator (just the number in a circle)
 */
interface RelevanceScoreIndicatorProps {
  score: number
  size?: "sm" | "md" | "lg"
  className?: string
}

export function RelevanceScoreIndicator({
  score,
  size = "sm",
  className,
}: RelevanceScoreIndicatorProps) {
  const label = scoreToLabel(score)

  const colorMap = {
    critical: "bg-red-500 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-yellow-500 text-black",
    low: "bg-blue-500 text-white",
    ignore: "bg-gray-400 text-white",
  }

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "rounded-full flex items-center justify-center font-bold",
              colorMap[label],
              sizeClasses[size],
              className
            )}
          >
            {score}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Relevance: {label.charAt(0).toUpperCase() + label.slice(1)} ({score}/100)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Relevance label selector (for use in forms)
 */
interface RelevanceLabelSelectorProps {
  value: RelevanceLabel | null
  onChange: (label: RelevanceLabel) => void
  disabled?: boolean
  className?: string
}

export function RelevanceLabelSelector({
  value,
  onChange,
  disabled = false,
  className,
}: RelevanceLabelSelectorProps) {
  const labels: RelevanceLabel[] = ["critical", "high", "medium", "low", "ignore"]

  return (
    <div className={cn("flex gap-1 flex-wrap", className)}>
      {labels.map((label) => {
        const display = getRelevanceDisplay(0, label)
        const isSelected = value === label

        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(label)}
            className={cn(
              "px-2 py-1 text-xs rounded-md border transition-all",
              isSelected
                ? cn(display.color, "ring-2 ring-offset-1")
                : "border-border hover:border-primary/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {display.label}
          </button>
        )
      })}
    </div>
  )
}

export { getRelevanceDisplay, scoreToLabel }
