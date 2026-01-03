"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Book, Terminal, Github, Code, Menu, Rocket, Package, HelpCircle, Key } from "lucide-react"
import { BrandLogo } from "@/components/ui/brand-logo"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Getting Started", href: "/docs", icon: Book },
  { name: "Quick Start", href: "/docs/quickstart", icon: Rocket },
  { name: "Playwright Reporter", href: "/docs/reporter", icon: Package },
  { name: "GitHub Action", href: "/docs/github-action", icon: Github },
  { name: "MCP Integration", href: "/docs/mcp", icon: Terminal },
  { name: "API Reference", href: "/docs/api", icon: Code },
  { name: "Troubleshooting", href: "/docs/troubleshooting", icon: HelpCircle },
]

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const NavLinks = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onLinkClick}
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
    </>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 sticky top-0 z-50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile menu trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle>Documentation</SheetTitle>
                </SheetHeader>
                <nav className="p-4 space-y-1">
                  <NavLinks onLinkClick={() => setMobileMenuOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>

            {/* Back link - truncate on mobile */}
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
          {/* Sidebar - Desktop */}
          <aside className="w-64 shrink-0 hidden md:block">
            <nav className="sticky top-20 space-y-1">
              <NavLinks />
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
