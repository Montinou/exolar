import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session-context"
import { LandingNav } from "@/components/landing-v2/LandingNav"
import { Hero } from "@/components/landing-v2/Hero"
import { ProblemSection } from "@/components/landing-v2/ProblemSection"
import { MechanismReveal } from "@/components/landing-v2/MechanismReveal"
import { SmartSelectionDemo } from "@/components/landing-v2/SmartSelectionDemo"
import { IntegrationsCode } from "@/components/landing-v2/IntegrationsCode"
import { RoadmapTeaser } from "@/components/landing-v2/RoadmapTeaser"
import { WishlistCTA } from "@/components/landing-v2/WishlistCTA"
import { LandingFooter } from "@/components/landing-v2/LandingFooter"

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  const session = await getSessionContext()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <>
      <LandingNav />
      <main className="relative overflow-x-clip">
        <Hero />
        <ProblemSection />
        <MechanismReveal />
        <SmartSelectionDemo />
        <IntegrationsCode />
        <RoadmapTeaser />
        <WishlistCTA />
      </main>
      <LandingFooter />
    </>
  )
}
