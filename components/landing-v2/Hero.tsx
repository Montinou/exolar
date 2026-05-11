"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Section } from "./atmosphere"
import { SuiteTreeCanvas } from "./SuiteTreeCanvas"

export function Hero() {
  const reduce = useReducedMotion()

  return (
    <Section variant="drench" className="!pt-40 !pb-32 sm:!pt-48 sm:!pb-40 lg:!pt-56">
      <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        {/* Left — headline */}
        <div className="relative">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--exolar-cyan)] opacity-60" />
              <span className="relative size-1.5 rounded-full bg-[var(--exolar-cyan)]" />
            </span>
            Smart selection · AI triage · pre-launch
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 max-w-2xl text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
          >
            CI is talking.
            <br />
            <span className="text-muted-foreground">Make it readable.</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 max-w-[58ch] text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Exolar reads your Playwright runs the way a senior engineer reads a post-mortem.
            Clusters failures. Names the flakes. Recommends which suites a PR can&apos;t actually break.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              href="#wishlist"
              className="group inline-flex h-12 items-center rounded-md bg-[var(--exolar-cyan)] px-5 text-sm font-medium text-[var(--exolar-cyan-foreground)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--exolar-cyan)_30%,transparent),0_8px_32px_-8px_color-mix(in_oklch,var(--exolar-cyan)_60%,transparent)] transition-all hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--exolar-cyan)_50%,transparent),0_16px_48px_-8px_color-mix(in_oklch,var(--exolar-cyan)_70%,transparent)]"
            >
              Join the wishlist
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#mechanism"
              className="inline-flex h-12 items-center rounded-md border border-border/70 bg-background/30 px-5 text-sm font-medium backdrop-blur transition-colors hover:bg-background/60"
            >
              See how it reads CI
            </Link>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.45 }}
            className="mt-12 flex items-center gap-6 text-xs text-muted-foreground"
          >
            <span className="font-mono uppercase tracking-wider">For platform / devex teams</span>
            <span className="h-px flex-1 bg-border/60 sm:max-w-[12rem]" />
            <span className="font-mono">v0.7 · shadow mode live</span>
          </motion.div>
        </div>

        {/* Right — heroic visual */}
        <div className="relative h-[480px] sm:h-[540px] lg:h-[600px]">
          <SuiteTreeCanvas />
        </div>
      </div>
    </Section>
  )
}
