"use client"

import type { ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui"
import { authClient } from "@/lib/auth/client"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSessionChange = async () => {
    router.refresh()

    // Check if user just signed in (has active session)
    const { data } = await authClient.getSession()
    if (data?.session) {
      // Only redirect if on auth pages (sign-in flow completed)
      if (pathname?.startsWith("/auth")) {
        // Use full page navigation to ensure session cookie is sent with request
        // (client-side router.push causes race condition with middleware)
        window.location.href = "/dashboard"
      }
    }
  }

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      emailOTP
      signUp={false}
      navigate={(path) => router.push(path)}
      replace={(path) => router.replace(path)}
      onSessionChange={handleSessionChange}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
