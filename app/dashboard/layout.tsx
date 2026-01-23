"use client"

import type React from "react"
import { AuthProvider } from "@/components/auth/auth-provider"
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
    <AuthProvider>
      <ProtectedLayout>
        <SidebarProvider defaultOpen={true}>
          <DashboardSidebar />
          <SidebarInset>
            {/* Enhanced header with glass effect */}
            <header
              className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b px-4 transition-all duration-300"
              style={{
                background: "oklch(0.145 0 0 / 0.85)",
                backdropFilter: "blur(12px) saturate(180%)",
                borderColor: "oklch(1 0 0 / 0.08)",
                boxShadow: "0 1px 3px oklch(0 0 0 / 0.1), 0 1px 2px oklch(0 0 0 / 0.06)",
              }}
            >
              <SidebarTrigger className="-ml-1 hover:bg-[var(--exolar-cyan)]/10 transition-colors duration-200" />
              <div className="flex-1" />
              <SearchTests />
            </header>

            {/* Announcement Banner */}
            <AnnouncementBanner />

            {/* Page content with smooth fade-in */}
            <div className="flex-1 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ProtectedLayout>
    </AuthProvider>
  )
}
