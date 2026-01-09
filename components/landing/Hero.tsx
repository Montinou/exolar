"use client"

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { WishlistForm } from "./WishlistForm"
import { FadeInOnScroll } from "@/components/ui/fade-in-on-scroll"
import { AnimatedBanner } from "./AnimatedBanner"

export function Hero() {
  return (
    <section className="relative flex flex-col overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.75 0.15 195 / 0.15), transparent)`,
        }}
      />

      {/* Full-width Header Banner */}
      <div className="relative z-10 w-full animate-in fade-in duration-1000">
        <AnimatedBanner />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm">
            <Sparkles className="w-4 h-4" style={{ color: "var(--safety-amber)" }} />
            <span className="text-muted-foreground">Exolar: First E2E Dashboard with Native MCP Support</span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight"
            style={{ color: "oklch(0.98 0 0)" }}
          >
            Test Results, Ready for the{" "}
            <span
              style={{
                background: "linear-gradient(90deg, oklch(0.75 0.15 195) 0%, oklch(0.78 0.18 75) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI Age
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-xl md:text-2xl max-w-2xl mx-auto"
            style={{ color: "oklch(0.7 0 0)" }}
          >
            Exolar QA is the first E2E testing platform with native Model Context Protocol (MCP) support.
            Let your AI agents debug your tests for you.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/dashboard" className="btn-amber flex items-center gap-2">
              Deploy Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs"
              className="btn-glass"
            >
              View Documentation
            </Link>
          </div>

          {/* Wishlist Form */}
          <div className="pt-8 max-w-lg mx-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Get early access updates
            </p>
            <WishlistForm />
          </div>
        </div>

        {/* Visual: Playwright <-> AI Connection */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Playwright Trace */}
            <FadeInOnScroll direction="left">
              <div className="glass-panel p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: "var(--exolar-cyan)" }}
                  />
                  <span className="font-mono text-sm text-muted-foreground">playwright-trace.json</span>
                </div>
                <div className="space-y-2 font-mono text-xs" style={{ color: "oklch(0.6 0 0)" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "oklch(0.5 0.15 0)" }}>FAIL</span>
                    <span>login.spec.ts:42</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "oklch(0.5 0.15 0)" }}>FAIL</span>
                    <span>checkout.spec.ts:89</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "oklch(0.65 0.15 140)" }}>PASS</span>
                    <span>home.spec.ts:15</span>
                  </div>
                </div>
              </div>
            </FadeInOnScroll>

            {/* Connection Glow */}
            <FadeInOnScroll direction="up" delay={150}>
              <div className="hidden md:flex items-center justify-center">
                <div className="relative">
                  <div
                    className="w-24 h-1 rounded-full animate-pulse"
                    style={{
                      background: "linear-gradient(90deg, var(--exolar-cyan), var(--safety-amber))",
                      boxShadow: "0 0 20px oklch(0.6 0.2 260 / 0.5)",
                    }}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-mono"
                    style={{ color: "var(--safety-amber)" }}
                  >
                    MCP
                  </div>
                </div>
              </div>
            </FadeInOnScroll>

            {/* AI Agent Terminal */}
            <FadeInOnScroll direction="right" delay={300}>
              <div className="glass-panel p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: "var(--safety-amber)" }}
                  />
                  <span className="font-mono text-sm text-muted-foreground">claude-agent</span>
                </div>
                <div className="space-y-2 font-mono text-xs" style={{ color: "oklch(0.7 0 0)" }}>
                  <div>
                    <span style={{ color: "var(--safety-amber)" }}>&gt;</span> Analyzing failures...
                  </div>
                  <div>
                    <span style={{ color: "var(--exolar-cyan)" }}>i</span> Found flaky test pattern
                  </div>
                  <div>
                    <span style={{ color: "oklch(0.65 0.15 140)" }}>+</span> Suggested fix: add wait
                  </div>
                </div>
              </div>
            </FadeInOnScroll>
          </div>
        </div>
      </div>
    </section>
  )
}
