import type React from "react"
import { AuthProvider } from "@/components/auth/auth-provider"
import { ProtectedLayout } from "@/components/auth/protected-layout"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ProtectedLayout>{children}</ProtectedLayout>
    </AuthProvider>
  )
}
