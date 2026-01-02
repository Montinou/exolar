"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui"
import { authClient } from "@/lib/auth/client"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      emailOTP
      signUp={false}
      navigate={(path) => router.push(path)}
      replace={(path) => router.replace(path)}
      onSessionChange={() => {
        router.refresh()
        router.push("/dashboard")
      }}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
