"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Activity, Gauge, GitCompare, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Reliability",
    href: "/dashboard/reliability",
    icon: Activity,
  },
  {
    label: "Performance",
    href: "/dashboard/performance",
    icon: Gauge,
  },
  {
    label: "Compare",
    href: "/dashboard/compare",
    icon: GitCompare,
  },
  {
    label: "Docs",
    href: "/docs",
    icon: BookOpen,
  },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 backdrop-blur">
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : item.href === "/docs"
              ? pathname.startsWith("/docs")
              : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              isActive
                ? "bg-[var(--exolar-cyan)]/10 text-[var(--exolar-cyan)] border border-[var(--exolar-cyan)]/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
