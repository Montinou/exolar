import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AlertTriangle } from "lucide-react"

interface FlakyBadgeProps {
  flakinessRate?: number
  flakyRuns?: number
  totalRuns?: number
  showTooltip?: boolean
}

export function FlakyBadge({
  flakinessRate,
  flakyRuns,
  totalRuns,
  showTooltip = true,
}: FlakyBadgeProps) {
  // Don't show badge if no flakiness or rate is below threshold
  if (!flakinessRate || flakinessRate === 0) {
    return null
  }

  // Determine badge color based on flakiness severity
  // 10-30%: yellow (low)
  // 30-60%: orange (medium)
  // 60-100%: red (high)
  const getBadgeClasses = () => {
    if (flakinessRate >= 60) {
      return "bg-[var(--status-error-light)] text-[var(--status-error)] border-[var(--status-error)]/20 hover:bg-[var(--status-error)]/20"
    }
    if (flakinessRate >= 30) {
      return "bg-[var(--status-warning-light)] text-[var(--status-warning)] border-[var(--status-warning)]/20 hover:bg-[var(--status-warning)]/20"
    }
    return "bg-[var(--status-warning-light)] text-[var(--status-warning)] border-[var(--status-warning)]/20 hover:bg-[var(--status-warning)]/20"
  }

  const getLabel = () => {
    if (flakinessRate >= 60) {
      return "Very Flaky"
    }
    return "Flaky"
  }

  const badge = (
    <Badge variant="outline" className={`gap-1 ${getBadgeClasses()}`}>
      <AlertTriangle className="h-3 w-3" />
      {getLabel()} {Math.round(flakinessRate)}%
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
          <p>
            This test was flaky in {flakyRuns ?? 0} of {totalRuns ?? 0} runs
          </p>
          <p className="text-xs text-muted-foreground">
            Flaky = passed after retry
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
