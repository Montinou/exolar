import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Standard in-app page wrapper. Provides consistent max-width, padding,
 * and vertical rhythm. Use as the immediate child of a route page.
 *
 *   export default function Page() {
 *     return (
 *       <PageContainer>
 *         <PageHeader ... />
 *         <Section> ... </Section>
 *       </PageContainer>
 *     )
 *   }
 */
export function PageContainer({
  children,
  className,
  width = "default",
}: {
  children: ReactNode
  className?: string
  width?: "default" | "wide" | "narrow"
}) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12",
        width === "default" && "max-w-7xl",
        width === "wide" && "max-w-[88rem]",
        width === "narrow" && "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Section divider inside a PageContainer. Use to group related content
 * with a quiet eyebrow label.
 */
export function PageSection({
  eyebrow,
  title,
  children,
  className,
  action,
}: {
  eyebrow?: string
  title?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={cn("mt-10 first:mt-0", className)}>
      {(eyebrow || title || action) && (
        <div className="mb-6 flex items-end justify-between gap-6 border-b border-border/50 pb-4">
          <div>
            {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className={cn("text-xl font-medium tracking-tight", eyebrow && "mt-2")}>
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
