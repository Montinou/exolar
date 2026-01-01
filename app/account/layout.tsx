import type React from "react"
import { ProtectedLayout } from "@/components/auth/protected-layout"

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>
}
