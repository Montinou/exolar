"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export interface TOCItem {
  id: string
  text: string
}

interface TableOfContentsProps {
  items: TOCItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: "-80px 0px -80% 0px" }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  const TOCLinks = () => (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={() => setIsOpen(false)}
            className={cn(
              "block py-1 transition-colors hover:text-foreground",
              activeId === item.id
                ? "text-primary font-medium"
                : "text-muted-foreground"
            )}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {/* Desktop: fixed position on far right for 2xl+ screens */}
      <nav className="hidden 2xl:block fixed right-8 top-24 w-56">
        <h4 className="text-sm font-semibold mb-3">On this page</h4>
        <TOCLinks />
      </nav>

      {/* Mobile/Tablet: collapsible at top of content */}
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="xl:hidden mb-6 p-4 rounded-lg border border-border bg-card"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
          On this page
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <TOCLinks />
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
