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
  { name: "GitHub Action", href: "/docs/github-action", icon: Github },
  { name: "MCP Integration", href: "/docs/mcp", icon: Terminal },
  { 
    name: "API Reference", 
    href: "/docs/api", 
    icon: Code,
    subItems: [
      { name: "Overview", href: "/docs/api" },
      { name: "Authentication", href: "/docs/api/authentication" },
    ]
  },
  { name: "Features", href: "/docs/features", icon: Gauge },
  { name: "Troubleshooting", href: "/docs/troubleshooting", icon: HelpCircle },
]

function DocsSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b border-border/40 px-4 py-3">
        <Link href="/docs" className="flex items-center gap-2">
          <BrandLogo variant="icon" width={24} height={24} />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">Documentation</span>
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

                // Items with sub-menus use collapsible
                if (hasSubItems) {
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

        {/* Main content */}
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <main className="max-w-3xl">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
