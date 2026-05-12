import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * Consistent empty state. Quiet — not a celebration, not a placeholder cube.
 * Anti-trap: no centered illustration + "Looks like you haven't ..." copy.
 * Read like a debrief: brief headline + reason, optional action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "surface flex flex-col items-start gap-3 p-8 text-left sm:p-10",
        className,
      )}
    >
      {Icon && (
        <div className="rounded-md border border-border/60 bg-background/60 p-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-medium tracking-tight text-foreground">{title}</h3>
      {description && (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
