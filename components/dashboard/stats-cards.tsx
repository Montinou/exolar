import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react"
import type { DashboardMetrics } from "@/lib/types"

interface StatsCardsProps {
  metrics: DashboardMetrics
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const stats = [
    {
      label: "Pass Rate",
      value: `${metrics.pass_rate.toFixed(1)}%`,
      description: "Last 7 days average",
      icon: CheckCircle2,
      trend: metrics.pass_rate >= 90 ? "positive" : metrics.pass_rate >= 75 ? "neutral" : "negative",
    },
    {
      label: "Avg Duration",
      value: `${(metrics.avg_duration_ms / 1000).toFixed(1)}s`,
      description: "Per test execution",
      icon: Clock,
      trend: "neutral",
    },
    {
      label: "Critical Failures",
      value: metrics.critical_failures.toString(),
      description: "Last 7 days",
      icon: AlertTriangle,
      trend: metrics.critical_failures === 0 ? "positive" : metrics.critical_failures <= 3 ? "neutral" : "negative",
    },
    {
      label: "Last 24h Runs",
      value: metrics.last_24h_executions.toString(),
      description: `${metrics.total_executions} total runs`,
      icon: XCircle,
      trend: "neutral",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <Icon
                  className={`h-4 w-4 ${
                    stat.trend === "positive"
                      ? "text-green-500"
                      : stat.trend === "negative"
                        ? "text-red-500"
                        : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
