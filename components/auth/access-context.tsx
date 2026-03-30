"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useUser } from "@clerk/nextjs"
import type { DashboardUser } from "@/lib/db"

interface AccessState {
  loading: boolean
  authorized: boolean
  reason?: string
  email?: string
  user?: DashboardUser
}

interface AccessContextValue extends AccessState {
  isAdmin: boolean
}

const AccessContext = createContext<AccessContextValue | null>(null)

export function useAccess() {
  const context = useContext(AccessContext)
  if (!context) {
    throw new Error("useAccess must be used within an AccessProvider")
  }
  return context
}

interface AccessProviderProps {
  children: ReactNode
}

export function AccessProvider({ children }: AccessProviderProps) {
  const { user, isLoaded } = useUser()

  const [accessState, setAccessState] = useState<AccessState>({
    loading: true,
    authorized: false,
  })

  // Only check invite status after session is confirmed from Clerk
  useEffect(() => {
    async function checkInviteStatus() {
      // If no user, not authenticated
      if (!user) {
        setAccessState({
          loading: false,
          authorized: false,
          reason: "not_authenticated",
          email: undefined,
        })
        return
      }

      // User exists - now check if user is invited (app-specific authorization)
      try {
        const response = await fetch("/api/auth/check-access")
        const data = await response.json()

        setAccessState({
          loading: false,
          authorized: data.authorized,
          reason: data.reason,
          email: data.email,
          user: data.user,
        })
      } catch (error) {
        console.error("[AccessProvider] Error checking access:", error)
        setAccessState({
          loading: false,
          authorized: false,
          reason: "error",
        })
      }
    }

    // Only run when Clerk has loaded
    if (isLoaded) {
      checkInviteStatus()
    }
  }, [user?.id, isLoaded])

  const value: AccessContextValue = {
    ...accessState,
    loading: !isLoaded || accessState.loading,
    isAdmin: accessState.user?.role === "admin",
  }

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  )
}
