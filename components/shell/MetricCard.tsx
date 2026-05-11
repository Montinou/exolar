import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * Numeric summary card for dashboards. Replaces inline stats-card markup.
 * Anti-trap: not a big-number-with-gradient. Number is solid color, weight
 * carries the hierarchy. Trend chip is a quiet inline tag, not the focus.
 *
 *   <MetricCard label="Pass rate (7d)" value="94.2%" trend={{ direction: "up", value: "+1.4" }} />
 */
export function MetricCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  accent = "neutral",
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  trend?: { direction: "up" | "down" | "flat"; value: string }
  icon?: LucideIcon
  accent?: "neutral" | "cyan" | "danger" | "warning" | "success"
  className?: string
}) {
  const accentLine =
    accent === "cyan"
      ? "bg-[var(--exolar-cyan)]"
      : accent === "danger"
        ? "bg-rose-500/80"
        : accent === "warning"
          ? "bg-amber-500/80"
          : accent === "success"
            ? "bg-emerald-500/80"
            : "bg-muted-foreground/40"

  return (
    <div
      className={cn(
        "surface-raised relative overflow-hidden p-5",
        className,
      )}
    >
      {/* Top accent rule — earns the color cue without using a side-stripe border (banned). */}
      <div className={cn("absolute inset-x-0 top-0 h-px", accentLine)} aria-hidden />

      <div className="flex items-start justify-between gap-4">
        <span className="page-eyebrow">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-3xl font-medium tabular-nums tracking-[-0.02em] sm:text-4xl">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums leading-none",
              trend.direction === "up" && "border-emerald-500/30 text-emerald-400",
              trend.direction === "down" && "border-rose-500/30 text-rose-400",
              trend.direction === "flat" && "border-border/50 text-muted-foreground",
            )}
          >
            {trend.direction === "up" && "↑"}
            {trend.direction === "down" && "↓"}
            {trend.direction === "flat" && "·"} {trend.value}
          </span>
        )}
      </div>

      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
