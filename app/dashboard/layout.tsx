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
            {/* Compact header with sidebar trigger and search */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="flex-1" />
              <SearchTests />
            </header>
            
            {/* Announcement Banner */}
            <AnnouncementBanner />
            
            {/* Page content */}
            <div className="flex-1">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ProtectedLayout>
    </AuthProvider>
  )
}
