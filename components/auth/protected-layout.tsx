"use client"

import type { ReactNode } from "react"
import { AccessGate } from "./access-gate"

interface ProtectedLayoutProps {
  children: ReactNode
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return <AccessGate>{children}</AccessGate>
}
