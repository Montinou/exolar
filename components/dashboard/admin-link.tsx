"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

export function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/auth/check-access")
        const data = await res.json()
        setIsAdmin(data.user?.role === "admin")
      } catch {
        setIsAdmin(false)
      }
    }
    checkAdmin()
  }, [])

  if (!isAdmin) return null

  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/admin" title="Admin Panel">
        <Settings className="h-5 w-5" />
      </Link>
    </Button>
  )
}
