"use client"

import type React from "react"
import { ProtectedLayout } from "@/components/auth/protected-layout"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AnnouncementBanner } from "@/components/dashboard/announcement-banner"
import { SearchTests } from "@/components/dashboard/search-tests"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedLayout>
      <SidebarProvider defaultOpen={true}>
        <DashboardSidebar />
        <SidebarInset className="relative">
          {/* Atmospheric backdrop — same language as the landing's hero, dialed
              way down. Sits behind everything so the page header has an
              ambient cyan presence that fades within the first viewport. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-grid-floor opacity-[0.35]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--exolar-cyan) 9%, transparent) 0%, transparent 70%)",
            }}
          />

          {/* Top bar — quiet hairline, no glassmorphism shadow stack. */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/40 bg-background/85 px-4 backdrop-blur-sm">
            <SidebarTrigger
              className="-ml-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Toggle sidebar"
            />
            <div className="flex-1" />
            <SearchTests />
          </header>

          <AnnouncementBanner />

          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedLayout>
  )
}
