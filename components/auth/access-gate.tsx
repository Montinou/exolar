"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useSession } from "@neondatabase/auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ShieldX, Mail, Loader2 } from "lucide-react"
import type { DashboardUser } from "@/lib/db-users"

interface AccessCheckResponse {
  authorized: boolean
  authenticated: boolean
  user?: DashboardUser
  email?: string
  reason?: "not_authenticated" | "not_invited"
  isNewUser?: boolean
}

interface AccessGateProps {
  children: ReactNode
}

export function AccessGate({ children }: AccessGateProps) {
  const session = useSession()
  const [accessState, setAccessState] = useState<{
    loading: boolean
    authorized: boolean
    reason?: string
    email?: string
    user?: DashboardUser
  }>({
    loading: true,
    authorized: false,
  })

  useEffect(() => {
    async function checkAccess() {
      // Wait for session to load
      if (session.isPending) return

      // If not logged in, we still need to check with server
      // (could be server-side session)
      try {
        const response = await fetch("/api/auth/check-access")
        const data: AccessCheckResponse = await response.json()

        setAccessState({
          loading: false,
          authorized: data.authorized,
          reason: data.reason,
          email: data.email,
          user: data.user,
        })
      } catch (error) {
        console.error("[AccessGate] Error checking access:", error)
        setAccessState({
          loading: false,
          authorized: false,
          reason: "error",
        })
      }
    }

    checkAccess()
  }, [session.data, session.isPending])

  // Show loading skeleton while checking
  if (accessState.loading || session.isPending) {
    return <AccessLoadingSkeleton />
  }

  // Not authenticated - show login prompt
  if (!accessState.authorized && accessState.reason === "not_authenticated") {
    return <LoginPrompt />
  }

  // Authenticated but not invited - show access denied
  if (!accessState.authorized && accessState.reason === "not_invited") {
    return <AccessDenied email={accessState.email} />
  }

  // Authorized - show content
  return <>{children}</>
}

function AccessLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  )
}

function LoginPrompt() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to access the E2E Test Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Use the sign-in button in the top right corner to authenticate with your email.
          </p>
          <p className="text-xs text-muted-foreground">
            Only invited users can access this dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function AccessDenied({ email }: { email?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don&apos;t have permission to access this dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && (
            <p className="text-sm text-center text-muted-foreground">
              Signed in as: <span className="font-medium">{email}</span>
            </p>
          )}
          <p className="text-sm text-center text-muted-foreground">
            Contact the administrator to request an invite.
          </p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
