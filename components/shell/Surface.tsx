import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * The canonical content panel. Three elevation levels, plus a drenched variant.
 *
 *   <Surface>...</Surface>            base
 *   <Surface raised>...</Surface>     primary content (cards, main panels)
 *   <Surface sunken>...</Surface>     code, logs, terminal
 *   <Surface drench>...</Surface>     atmospheric (use sparingly)
 *
 * Replaces .glass-card / .glass-card-glow without using glassmorphism.
 */
export function Surface({
  children,
  className,
  raised,
  sunken,
  drench,
  padding = "default",
  asChild,
}: {
  children: ReactNode
  className?: string
  raised?: boolean
  sunken?: boolean
  drench?: boolean
  padding?: "none" | "tight" | "default" | "loose"
  asChild?: boolean
}) {
  const variant = raised
    ? "surface-raised"
    : sunken
      ? "surface-sunken"
      : drench
        ? "surface-drench"
        : "surface"

  const pad =
    padding === "none"
      ? ""
      : padding === "tight"
        ? "p-3"
        : padding === "loose"
          ? "p-8"
          : "p-5 sm:p-6"

  const classes = cn(variant, pad, className)

  if (asChild) {
    // Render the child directly with the classes merged (for cases where
    // the consumer wants a different element type like <button> or <a>).
    return <div className={classes}>{children}</div>
  }
  return <div className={classes}>{children}</div>
}
