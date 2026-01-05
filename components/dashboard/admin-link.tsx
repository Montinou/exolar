"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useAccess } from "@/components/auth/access-context"

export function AdminLink() {
  const { isAdmin, loading } = useAccess()

  if (loading || !isAdmin) return null

  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/admin" title="Admin Panel">
        <Settings className="h-5 w-5" />
      </Link>
    </Button>
  )
}
