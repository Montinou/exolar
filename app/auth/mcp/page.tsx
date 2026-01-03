"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Terminal } from "lucide-react"

function MCPAuthContent() {
  const searchParams = useSearchParams()
  // Get port from URL params, or fallback to sessionStorage
  const urlPort = searchParams.get("port")
  const [callbackPort, setCallbackPort] = useState<string | null>(urlPort)
  const [status, setStatus] = useState<"loading" | "ready" | "authorizing" | "success" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  // On mount, check sessionStorage if port not in URL
  useEffect(() => {
    if (!urlPort) {
      const storedPort = sessionStorage.getItem("mcp_callback_port")
      if (storedPort) {
        setCallbackPort(storedPort)
        // Clean up sessionStorage after retrieving
        sessionStorage.removeItem("mcp_callback_port")
      }
    }
  }, [urlPort])

  useEffect(() => {
    // Check if user is authenticated
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session")
        if (res.ok) {
          setStatus("ready")
        } else {
          // Store the port in sessionStorage as backup
          if (callbackPort) {
            sessionStorage.setItem("mcp_callback_port", callbackPort)
          }
          // Redirect to login with callback URL to return here after auth
          const currentUrl = window.location.href
          const signInUrl = `/auth/sign-in?callbackUrl=${encodeURIComponent(currentUrl)}`
          window.location.href = signInUrl
        }
      } catch {
        setError("Failed to check authentication status")
        setStatus("error")
      }
    }
    checkAuth()
  }, [callbackPort])

  async function authorizeAndRedirect() {
    if (!callbackPort) {
      setError("Missing callback port. Please restart the MCP authentication flow.")
      setStatus("error")
      return
    }

    setStatus("authorizing")

    try {
      // Generate MCP token
      const res = await fetch("/api/auth/mcp-token", {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to generate token")
      }

      const { token, organizationId, organizationSlug, expiresAt } = await res.json()

      // Build callback URL
      const dashboardUrl = window.location.origin
      const callbackUrl = `http://localhost:${callbackPort}/callback?token=${encodeURIComponent(token)}&dashboardUrl=${encodeURIComponent(dashboardUrl)}&organizationId=${organizationId}&organizationSlug=${encodeURIComponent(organizationSlug)}&expiresAt=${encodeURIComponent(expiresAt)}`

      setStatus("success")

      // Redirect to callback after short delay to show success
      setTimeout(() => {
        window.location.href = callbackUrl
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed")
      setStatus("error")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card glass-card-glow">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Authorize Claude Code</CardTitle>
          <CardDescription>
            Grant Claude Code access to your Aestra data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="glass-panel rounded-lg p-4 text-sm space-y-2">
                <p className="font-medium">Claude Code will be able to:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>View your test executions and results</li>
                  <li>Search tests and view history</li>
                  <li>Access dashboard metrics and trends</li>
                  <li>View flakiness reports</li>
                </ul>
              </div>
              <Button onClick={authorizeAndRedirect} className="w-full">
                Authorize Access
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                You can revoke access at any time from your settings
              </p>
            </>
          )}

          {status === "authorizing" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating access token...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-medium">Authorization successful!</p>
              <p className="text-xs text-muted-foreground">Redirecting back to Claude Code...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-red-500 text-xl">!</span>
              </div>
              <p className="text-sm font-medium text-red-500">Authorization failed</p>
              <p className="text-xs text-muted-foreground text-center">{error}</p>
              <Button variant="outline" onClick={() => setStatus("ready")}>
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card glass-card-glow">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Authorize Claude Code</CardTitle>
          <CardDescription>
            Grant Claude Code access to your Aestra data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MCPAuthPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MCPAuthContent />
    </Suspense>
  )
}
