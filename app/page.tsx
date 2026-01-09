import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { Hero } from "@/components/landing/Hero"
import { MCPShowcase } from "@/components/landing/MCPShowcase"
import { DeviceShowcase } from "@/components/landing/DeviceShowcase"
import { FeaturesGrid } from "@/components/landing/FeaturesGrid"
import { InstallTabs } from "@/components/landing/InstallTabs"

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  // Redirect signed-in users to dashboard
  const session = await getSessionContext()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--deep-void)" }}>
      <Hero />
      <MCPShowcase />
      <DeviceShowcase />
      <FeaturesGrid />
      <InstallTabs />
    </main>
  )
}
