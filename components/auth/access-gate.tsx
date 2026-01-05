"use client"

import Image from "next/image"

import { useEffect, type ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"
import { BrandLogo } from "@/components/ui/brand-logo"
import { AccessProvider, useAccess } from "./access-context"

interface AccessGateProps {
  children: ReactNode
}

export function AccessGate({ children }: AccessGateProps) {
  return (
    <AccessProvider>
      <AccessGateContent>{children}</AccessGateContent>
    </AccessProvider>
  )
}

function AccessGateContent({ children }: AccessGateProps) {
  const { loading, authorized, reason, email } = useAccess()

  // Check for pending MCP callback after successful auth
  useEffect(() => {
    if (!loading && typeof window !== "undefined") {
      const mcpPort = sessionStorage.getItem("mcp_callback_port")
      if (mcpPort) {
        sessionStorage.removeItem("mcp_callback_port")
        window.location.href = `/auth/mcp?port=${mcpPort}`
      }
    }
  }, [loading])

  // Show loading skeleton while checking
  if (loading) {
    return <AccessLoadingSkeleton />
  }

  // Not authenticated - show login prompt
  if (!authorized && reason === "not_authenticated") {
    return <LoginPrompt />
  }

  // Authenticated but not invited - show access denied
  if (!authorized && reason === "not_invited") {
    return <AccessDenied email={email} />
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
          <div className="mx-auto mb-4 h-16 w-16 relative flex items-center justify-center">
            <Image
              src="/branding/logo-icon.png"
              alt="Exolar Logo" 
              fill 
              className="object-contain rounded-full"
            />
          </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to access Exolar QA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Button asChild>
              <a href="/auth/sign-in">Sign In with Email</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
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
          <div className="mx-auto mb-6 flex justify-center">
            <BrandLogo variant="icon" width={48} height={48} />
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
