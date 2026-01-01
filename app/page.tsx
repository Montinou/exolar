import { Hero } from "@/components/landing/Hero"
import { MCPShowcase } from "@/components/landing/MCPShowcase"
import { DeviceShowcase } from "@/components/landing/DeviceShowcase"
import { FeaturesGrid } from "@/components/landing/FeaturesGrid"
import { InstallTabs } from "@/components/landing/InstallTabs"
import { Footer } from "@/components/landing/Footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--deep-void)" }}>
      <Hero />
      <MCPShowcase />
      <DeviceShowcase />
      <FeaturesGrid />
      <InstallTabs />
      <Footer />
    </main>
  )
}
