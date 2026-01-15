"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Activity,
  Gauge,
  GitCompare,
  Sparkles,
  BookOpen,
  Settings,
  LogOut,
  ChevronUp,
  Shield,
  Webhook,
  Key,
} from "lucide-react"
import { authClient } from "@/lib/auth/client"
import { useAccess } from "@/components/auth/access-context"
import { BrandLogo } from "@/components/ui/brand-logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
    label: "AI Search",
    href: "/dashboard/search",
    icon: Sparkles,
  },
  {
    label: "Mock APIs",
    href: "/dashboard/mocks",
    icon: Webhook,
  },
  {
    label: "Documentation",
    href: "/docs",
    icon: BookOpen,
  },
]

function DashboardSidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { data: session } = authClient.useSession()
  const { isAdmin } = useAccess()
  
  const userEmail = session?.user?.email || ""
  const userInitials = userEmail
    ? userEmail
        .split("@")[0]
        .split(".")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  const handleSignOut = async () => {
    await authClient.signOut()
    // Domain-based redirect after sign out
    const hostname = window.location.hostname
    if (hostname.includes("e2e-test-dashboard")) {
      window.location.href = "/auth/sign-in"
    } else {
      window.location.href = "/"
    }
  }

  return (
    <>
      <SidebarHeader className="border-b border-border/40 px-4 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
        <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <BrandLogo variant="animated-icon" width={28} />
          <span
            className="font-bold text-lg group-data-[collapsible=icon]:hidden"
            style={{
              background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Exolar
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : item.href === "/docs"
                      ? pathname.startsWith("/docs")
                      : pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40">
        <SidebarMenu>
          {/* API Keys - visible to all */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/settings/api-keys")} tooltip="API Keys">
              <Link href="/settings/api-keys">
                <Key className="h-4 w-4" />
                <span>API Keys</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Admin link if admin */}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")} tooltip="Admin">
                <Link href="/admin">
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          
          {/* Settings */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip="Settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* User menu */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip={userEmail}
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-cyan-500 to-orange-500 text-white text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userEmail.split("@")[0]}</span>
                    <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isCollapsed ? "right" : "top"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-red-500">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </>
  )
}

export function DashboardSidebar() {
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <DashboardSidebarContent />
    </Sidebar>
  )
}
