"use client"

import { useEffect, useState } from "react"
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

// Animated number component for smooth counting
function AnimatedNumber({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    if (hasAnimated) {
      setDisplayValue(value)
      return
    }

    const duration = 800
    const steps = 30
    const stepDuration = duration / steps
    const increment = value / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      if (currentStep >= steps) {
        setDisplayValue(value)
        setHasAnimated(true)
        clearInterval(timer)
      } else {
        setDisplayValue(increment * currentStep)
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [value, hasAnimated])

  return (
    <span className="tabular-nums">
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  )
}

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
      description: "Per suite execution",
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

  // Animation delay classes for staggered entrance
  const delayClasses = ["delay-1", "delay-2", "delay-3", "delay-4"]

  return (
    <TooltipProvider>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={cn(
                "glass-card glass-card-glow p-6 animate-fade-in-up",
                delayClasses[index]
              )}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    {stat.label}
                    {stat.tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help transition-colors hover:text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{stat.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  <div
                    className="p-1.5 rounded-lg transition-all duration-300"
                    style={{
                      background: stat.trend === "positive"
                        ? "oklch(0.72 0.19 145 / 0.15)"
                        : stat.trend === "negative"
                          ? "oklch(0.65 0.22 25 / 0.15)"
                          : "oklch(0.75 0.15 195 / 0.15)"
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color: stat.trend === "positive"
                          ? "var(--status-success)"
                          : stat.trend === "negative"
                            ? "var(--status-error)"
                            : "var(--exolar-cyan)"
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className={cn(
                    "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight animate-count",
                    getValueClass(stat.type, stat.trend)
                  )}>
                    {stat.type === "passRate" && (
                      <AnimatedNumber value={metrics.pass_rate} suffix="%" decimals={1} />
                    )}
                    {stat.type === "failRate" && (
                      <AnimatedNumber value={metrics.failure_rate} suffix="%" decimals={1} />
                    )}
                    {stat.type === "duration" && (
                      <AnimatedNumber value={metrics.avg_duration_ms / 1000} suffix="s" decimals={1} />
                    )}
                    {stat.type === "critical" && (
                      <AnimatedNumber value={metrics.critical_failures} decimals={0} />
                    )}
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
