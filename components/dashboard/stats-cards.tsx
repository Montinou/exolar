import { CheckCircle2, XCircle, Clock, AlertTriangle, Info } from "lucide-react"
import type { DashboardMetrics } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface StatsCardsProps {
  metrics: DashboardMetrics
}

type StatType = "passRate" | "failRate" | "duration" | "critical"

export function StatsCards({ metrics }: StatsCardsProps) {
  const stats: Array<{
    label: string
    value: string
    description: string
    icon: typeof CheckCircle2
    trend: "positive" | "negative" | "neutral"
    type: StatType
    tooltip?: string
  }> = [
    {
      label: "Pass Rate",
      value: `${metrics.pass_rate.toFixed(1)}%`,
      description: `${metrics.total_executions} total runs`,
      icon: CheckCircle2,
      trend: metrics.pass_rate >= 90 ? "positive" : metrics.pass_rate >= 75 ? "neutral" : "negative",
      type: "passRate",
      tooltip: "Pass Rate = Passed ÷ (Passed + Failed). Skipped tests are excluded.",
    },
    {
      label: "Failure Rate",
      value: `${metrics.failure_rate.toFixed(1)}%`,
      description: `${metrics.failure_volume} failed runs`,
      icon: XCircle,
      trend: metrics.failure_rate <= 5 ? "positive" : metrics.failure_rate <= 15 ? "neutral" : "negative",
      type: "failRate",
    },
    {
      label: "Avg Duration",
      value: `${(metrics.avg_duration_ms / 1000).toFixed(1)}s`,
      description: "Per test execution",
      icon: Clock,
      trend: "neutral",
      type: "duration",
    },
    {
      label: "Critical Failures",
      value: metrics.critical_failures.toString(),
      description: "Last 7 days",
      icon: AlertTriangle,
      trend: metrics.critical_failures === 0 ? "positive" : metrics.critical_failures <= 3 ? "neutral" : "negative",
      type: "critical",
    },
  ]

  // Get the appropriate value class based on stat type
  const getValueClass = (type: StatType, trend: string) => {
    switch (type) {
      case "passRate":
        return "stat-value-success"
      case "failRate":
        return trend === "positive" ? "stat-value-success" : "stat-value-error"
      case "critical":
        return trend === "positive" ? "stat-value-success" : trend === "negative" ? "stat-value-error" : "stat-value-warning"
      case "duration":
        return "stat-value-cyan"
      default:
        return ""
    }
  }

  return (
    <TooltipProvider>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="glass-card glass-card-glow p-6"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    {stat.label}
                    {stat.tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{stat.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  <Icon
                    className="h-5 w-5"
                    style={{
                      color: stat.trend === "positive"
                        ? "var(--status-success)"
                        : stat.trend === "negative"
                          ? "var(--status-error)"
                          : "var(--exolar-cyan)"
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <p className={cn(
                    "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
                    getValueClass(stat.type, stat.trend)
                  )}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
