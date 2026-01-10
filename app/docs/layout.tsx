"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// Navigation items with optional sub-items
const navigation = [
  { name: "Getting Started", href: "/docs", icon: Book },
  { name: "Quick Start", href: "/docs/quickstart", icon: Rocket },
  { 
    name: "Playwright Reporter", 
    href: "/docs/reporter", 
    icon: Package,
    subItems: [
      { name: "Overview", href: "/docs/reporter" },
      { name: "npm Package", href: "/docs/reporter/npm" },
    ]
  },
  { 
    name: "GitHub Action", 
    href: "/docs/github-action", 
    icon: Github,
    subItems: [
      { name: "Quick Start", href: "/docs/github-action#quick-start" },
      { name: "Configuration", href: "/docs/github-action#configuration" },
      { name: "Playwright Config", href: "/docs/github-action#playwright-config" },
      { name: "Troubleshooting", href: "/docs/github-action#troubleshooting" },
    ]
  },
  {
    name: "MCP Integration",
    href: "/docs/mcp",
    icon: Terminal,
    subItems: [
      { name: "Installation", href: "/docs/mcp#installation" },
      { name: "Architecture", href: "/docs/mcp#architecture" },
      { name: "Tools (5)", href: "/docs/mcp#tools" },
      { name: "Datasets (14)", href: "/docs/mcp#datasets" },
      { name: "Migration", href: "/docs/mcp#migration" },
      { name: "Examples", href: "/docs/mcp#examples" },
      { name: "Security", href: "/docs/mcp#security" },
      { name: "Troubleshooting", href: "/docs/mcp#troubleshooting" },
    ]
  },
  { 
    name: "API Reference", 
    href: "/docs/api", 
    icon: Code,
    subItems: [
      { name: "Overview", href: "/docs/api" },
      { name: "Authentication", href: "/docs/api/authentication" },
    ]
  },
  { 
    name: "Features", 
    href: "/docs/features", 
    icon: Gauge,
    subItems: [
      { name: "Reliability Score", href: "/docs/features#reliability-score" },
      { name: "Flaky Detection", href: "/docs/features#flaky-detection" },
      { name: "Performance Regression", href: "/docs/features#performance-regression" },
      { name: "Multi-tenancy", href: "/docs/features#multi-tenancy" },
      { name: "AI Analysis", href: "/docs/features#ai-analysis" },
    ]
  },
  { name: "Troubleshooting", href: "/docs/troubleshooting", icon: HelpCircle },
]

function DocsSidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <>
      <SidebarHeader className="border-b border-border/40 px-4 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
        <Link href="/docs" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <BrandLogo variant="animated-icon" width={24} />
          <span
            className="font-semibold group-data-[collapsible=icon]:hidden"
            style={{
              background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >Documentation</span>
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
                const hasSubItems = item.subItems && item.subItems.length > 0
                const isSubItemActive = hasSubItems && item.subItems.some(
                  sub => pathname === sub.href
                )

                // Items with sub-menus use collapsible (only when expanded)
                if (hasSubItems) {
                  // When collapsed, navigate directly instead of toggling
                  if (isCollapsed) {
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          tooltip={item.name}
                          isActive={isActive || isSubItemActive}
                          onClick={() => router.push(item.href)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }

                  return (
                    <Collapsible
                      key={item.name}
                      asChild
                      defaultOpen={isActive || isSubItemActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.name} isActive={isActive || isSubItemActive}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.href}
                                >
                                  <Link href={subItem.href}>
                                    <span>{subItem.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                // Regular items without sub-menus
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
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
    </>
  )
}

function DocsSidebar() {
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <DocsSidebarContent />
    </Sidebar>
  )
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <DocsSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="border-b border-border/40 sticky top-0 z-50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Sidebar trigger for both mobile and desktop */}
              <SidebarTrigger />

              {/* Back link */}
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Home</span>
              </Link>
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

        {/* Main content */}
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <main className="max-w-3xl">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
