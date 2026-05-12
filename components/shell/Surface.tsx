import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * The canonical content panel. Three elevation levels, plus a drenched variant.
 *
 *   <Surface>...</Surface>                       default
 *   <Surface variant="raised">...</Surface>      primary content (cards, main panels)
 *   <Surface variant="sunken">...</Surface>      code, logs, terminal
 *   <Surface variant="drench">...</Surface>      atmospheric (use sparingly)
 *
 * Replaces .glass-card / .glass-card-glow without using glassmorphism.
 *
 * Variant is a single union (not 3 boolean flags) so mutually-exclusive
 * elevations are enforced at the type level — no `<Surface raised sunken>`
 * with silent precedence.
 */

type Variant = "default" | "raised" | "sunken" | "drench"
type Padding = "none" | "tight" | "default" | "loose"

const VARIANT_CLASS: Record<Variant, string> = {
  default: "surface",
  raised: "surface-raised",
  sunken: "surface-sunken",
  drench: "surface-drench",
}

const PADDING_CLASS: Record<Padding, string> = {
  none: "",
  tight: "p-3",
  default: "p-5 sm:p-6",
  loose: "p-8",
}

export function Surface({
  children,
  className,
  variant = "default",
  padding = "default",
}: {
  children: ReactNode
  className?: string
  variant?: Variant
  padding?: Padding
}) {
  return (
    <div className={cn(VARIANT_CLASS[variant], PADDING_CLASS[padding], className)}>
      {children}
    </div>
  )
}
