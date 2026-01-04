"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Book,
  Terminal,
  Github,
  Code,
  Rocket,
  Package,
  HelpCircle,
  Gauge,
  ArrowLeft,
} from "lucide-react"
import { BrandLogo } from "@/components/ui/brand-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Getting Started", href: "/docs", icon: Book },
  { name: "Quick Start", href: "/docs/quickstart", icon: Rocket },
  { name: "Playwright Reporter", href: "/docs/reporter", icon: Package },
  { name: "GitHub Action", href: "/docs/github-action", icon: Github },
  { name: "MCP Integration", href: "/docs/mcp", icon: Terminal },
  { name: "API Reference", href: "/docs/api", icon: Code },
  { name: "Features", href: "/docs/features", icon: Gauge },
  { name: "Troubleshooting", href: "/docs/troubleshooting", icon: HelpCircle },
]

function DocsSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <SidebarHeader className="border-b border-border/40 px-4 py-3">
        <Link href="/docs" className="flex items-center gap-2">
          <BrandLogo variant="icon" width={24} height={24} />
          <span className="font-semibold">Documentation</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/docs" && pathname.startsWith(item.href + "/"))
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen w-full flex bg-background">
        {/* Sidebar */}
        <DocsSidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="border-b border-border/40 sticky top-0 z-50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <div className="container mx-auto px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Mobile sidebar trigger */}
                <SidebarTrigger className="md:hidden" />

                {/* Back link */}
                <Link
                  href="/"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Home</span>
                </Link>
                <span className="text-border hidden sm:block">/</span>
                <div className="hidden sm:flex items-center gap-2">
                  <BrandLogo variant="icon" width={24} height={24} />
                  <span className="font-semibold">Documentation</span>
                </div>
              </div>
              <Link
                href="https://github.com/Montinou/e2e-test-dashboard"
                target="_blank"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </Link>
            </div>
          </header>

          <div className="container mx-auto px-4 py-6 sm:py-8">
            <div className="flex gap-4 sm:gap-6 lg:gap-8">
              {/* Desktop sidebar navigation */}
              <aside className="w-64 shrink-0 hidden md:block">
                <nav className="sticky top-20 space-y-1">
                  {navigation.map((item) => {
                    const pathname = typeof window !== "undefined" ? window.location.pathname : ""
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/docs" && pathname.startsWith(item.href + "/"))
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    )
                  })}
                </nav>
              </aside>

              {/* Main content */}
              <main className="flex-1 min-w-0 max-w-3xl">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
