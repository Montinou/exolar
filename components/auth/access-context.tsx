"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { authClient } from "@/lib/auth/client"
import type { DashboardUser } from "@/lib/db-users"

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
  // Use Neon Auth SDK's useSession hook for session state (with caching/deduplication)
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()
  
  const [accessState, setAccessState] = useState<AccessState>({
    loading: true,
    authorized: false,
  })

  // Only check invite status after session is confirmed from SDK
  useEffect(() => {
    async function checkInviteStatus() {
      // If no session, user is not authenticated
      if (!sessionData?.session) {
        setAccessState({
          loading: false,
          authorized: false,
          reason: "not_authenticated",
          email: undefined,
        })
        return
      }

      // Session exists - now check if user is invited (app-specific authorization)
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

    // Only run when session loading is complete
    if (!sessionPending) {
      checkInviteStatus()
    }
  }, [sessionData?.session?.id, sessionPending])

  const value: AccessContextValue = {
    ...accessState,
    loading: sessionPending || accessState.loading,
    isAdmin: accessState.user?.role === "admin",
  }

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  )
}
