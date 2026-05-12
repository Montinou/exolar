"use client"

import { cn } from "@/lib/utils"
import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Atmosphere primitives shared across the landing.
 *
 * Three layers, composable:
 *   <GridFloor />          — subtle grid, fades up from bottom
 *   <RadialGlow />         — drenched cyan glow, top-center
 *   <NoiseFilm />          — film grain, low-opacity
 *
 * All layers respect prefers-reduced-motion and degrade gracefully.
 */

export function GridFloor({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 opacity-[0.18] dark:opacity-[0.24]",
        "[background-image:linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_8%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground)_8%,transparent)_1px,transparent_1px)]",
        "[background-size:64px_64px]",
        "[mask-image:radial-gradient(ellipse_70%_50%_at_50%_30%,black_30%,transparent_85%)]",
        className,
      )}
    />
  )
}

export function RadialGlow({
  className,
  intensity = "default",
  color = "cyan",
}: {
  className?: string
  intensity?: "low" | "default" | "high"
  color?: "cyan" | "neutral"
}) {
  const baseColor = color === "cyan" ? "var(--exolar-cyan)" : "var(--foreground)"
  const opacity = intensity === "low" ? 0.18 : intensity === "high" ? 0.55 : 0.32

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3"
        style={{
          width: "min(110rem, 140vw)",
          height: "min(70rem, 80vh)",
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklch, ${baseColor} ${opacity * 100}%, transparent) 0%, transparent 60%)`,
        }}
      />
    </div>
  )
}

export function NoiseFilm({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 mix-blend-overlay opacity-[0.045] dark:opacity-[0.07]",
        className,
      )}
      style={{
        // Small inline SVG noise — no extra HTTP request, tiny.
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>")`,
      }}
    />
  )
}

/**
 * Fade-in-on-mount wrapper used across the landing.
 * - Exponential ease-out (skill: no bounce, no elastic).
 * - First child fades in on viewport entry, never repeats.
 * - Respects prefers-reduced-motion: no transform, no opacity transition.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: "div" | "section" | "p" | "h1" | "h2" | "h3" | "li"
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    const StaticTag = Tag as keyof JSX.IntrinsicElements
    return <StaticTag className={className}>{children}</StaticTag>
  }
  const Component = motion[Tag as keyof typeof motion] as typeof motion.div
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{
        duration: 0.85,
        delay,
        ease: [0.16, 1, 0.3, 1], // ease-out-quart-ish
      }}
    >
      {children}
    </Component>
  )
}

/**
 * Section shell — consistent vertical rhythm + container max-width.
 * Variants control atmospheric weight:
 *   - "drench"  → full cyan atmosphere (hero, CTA)
 *   - "quiet"   → minimal background (editorial sections)
 *   - "code"    → subtle grid only (code-native sections)
 *   - "panel"   → flat surface with single accent edge (roadmap teaser)
 */
type Variant = "drench" | "quiet" | "code" | "panel"

export function Section({
  children,
  variant = "quiet",
  className,
  id,
  fullBleed = false,
}: {
  children: ReactNode
  variant?: Variant
  className?: string
  id?: string
  fullBleed?: boolean
}) {
  const base = "relative isolate"
  const padding = "py-24 sm:py-32 lg:py-40"

  return (
    <section
      id={id}
      className={cn(
        base,
        padding,
        variant === "panel" && "border-y border-border/40",
        className,
      )}
    >
      {variant === "drench" && (
        <>
          <RadialGlow intensity="high" />
          <GridFloor />
          <NoiseFilm />
        </>
      )}
      {variant === "quiet" && <NoiseFilm className="opacity-[0.025] dark:opacity-[0.04]" />}
      {variant === "code" && <GridFloor className="opacity-[0.09] dark:opacity-[0.12]" />}

      <div
        className={cn(
          fullBleed ? "px-6 lg:px-12" : "mx-auto max-w-7xl px-6 lg:px-8",
        )}
      >
        {children}
      </div>
    </section>
  )
}
