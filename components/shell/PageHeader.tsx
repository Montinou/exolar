import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Consistent page header for all in-app routes.
 *
 *   <PageHeader eyebrow="Smart selection" title="Audit" lede="..." actions={...} />
 *
 * Uses the .page-eyebrow / .page-title / .page-lede typography utilities
 * from globals.css so the rhythm is identical across surfaces.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  lede?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col gap-6 pb-6", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
          <h1 className={cn("page-title", eyebrow && "mt-3")}>{title}</h1>
          {lede && <p className="page-lede">{lede}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
