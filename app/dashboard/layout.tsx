import type React from "react"
import { AuthProvider } from "@/components/auth/auth-provider"
import { ProtectedLayout } from "@/components/auth/protected-layout"

export default function DashboardLayout({
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
