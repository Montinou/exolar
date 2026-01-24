"use client"

import { Skeleton } from "@/components/ui/skeleton"

interface ChartSkeletonProps {
  height?: string
  title?: string
}

/**
 * Reusable skeleton for chart components during dynamic import loading
 */
export function ChartSkeleton({ height = "h-[200px]", title }: ChartSkeletonProps) {
  return (
    <div className="glass-card glass-card-glow p-6">
      {title ? (
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      ) : (
        <Skeleton className="h-4 w-40 mb-4" />
      )}
      <div className={`${height} flex items-center justify-center`}>
        <div className="w-full h-full rounded-lg bg-accent/50 animate-pulse" />
      </div>
    </div>
  )
}
