"use client"

import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Hero visual: an animated, abstracted post-mortem view.
 *
 * What it shows in ~7s:
 *   1. A column of suite/test rows materialize (the "raw" CI signal).
 *   2. Failure nodes pulse and start to cluster — lines connect related fails.
 *   3. A second column condenses into 3 "verdicts" (the triage report).
 *
 * It's not the product UI; it's a recognizable abstraction of what Exolar does.
 * Respects prefers-reduced-motion (renders the final state immediately).
 */

const TESTS = [
  { name: "marketplace › sort by recent", status: "pass" },
  { name: "checkout › apply promo code", status: "fail" },
  { name: "auth › reset password", status: "pass" },
  { name: "checkout › split shipping", status: "fail" },
  { name: "search › fuzzy results", status: "flaky" },
  { name: "marketplace › filter chips", status: "pass" },
  { name: "checkout › refund flow", status: "fail" },
  { name: "auth › sso callback", status: "pass" },
  { name: "search › empty state", status: "pass" },
] as const

const VERDICTS = [
  { label: "Cluster · Checkout promo path", count: 3, hue: "fail" as const },
  { label: "Flake · network timing", count: 1, hue: "flaky" as const },
  { label: "Safe · 5 suites · skippable", count: 5, hue: "pass" as const },
]

export function SuiteTreeCanvas() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(reduce ? 3 : 0)

  useEffect(() => {
    if (reduce) return
    const t1 = setTimeout(() => setPhase(1), 600)
    const t2 = setTimeout(() => setPhase(2), 2400)
    const t3 = setTimeout(() => setPhase(3), 3800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [reduce])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border/50 bg-background/30 p-5 backdrop-blur-md sm:p-7">
      {/* Inner gradient — quietly cyan, lifts the panel from the section's drench */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 0%, color-mix(in oklch, var(--exolar-cyan) 18%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative grid h-full grid-cols-[1fr_auto_1fr] items-stretch gap-3 sm:gap-5">
        {/* Left column — raw signal */}
        <div className="flex flex-col gap-1.5">
          <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            <span>raw · CI run #2871</span>
            <span className="size-1.5 rounded-full bg-[var(--exolar-cyan)] opacity-70" />
          </div>
          {TESTS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={reduce ? false : { opacity: 0, x: -20 }}
              animate={
                reduce
                  ? undefined
                  : phase >= 1
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: -20 }
              }
              transition={{
                duration: 0.5,
                delay: 0.04 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-mono leading-tight",
                t.status === "pass" &&
                  "border-border/40 bg-background/40 text-muted-foreground",
                t.status === "fail" &&
                  "border-rose-500/30 bg-rose-500/[0.06] text-foreground",
                t.status === "flaky" &&
                  "border-amber-500/30 bg-amber-500/[0.06] text-foreground",
              )}
            >
              <StatusDot status={t.status} pulse={phase === 2 && t.status !== "pass"} />
              <span className="truncate">{t.name}</span>
            </motion.div>
          ))}
        </div>

        {/* Middle — connecting lines from phase 2 onward */}
        <div className="relative w-16 sm:w-20">
          <motion.svg
            viewBox="0 0 100 320"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            initial={false}
            animate={{ opacity: phase >= 2 ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Three converging lines: fail → cluster · flaky → flake · pass → skippable */}
            <path
              d="M0 90 C 50 90, 50 60, 100 60"
              stroke="color-mix(in oklch, var(--rose-500, oklch(0.65 0.22 22)) 70%, transparent)"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M0 140 C 50 140, 50 60, 100 60"
              stroke="color-mix(in oklch, var(--rose-500, oklch(0.65 0.22 22)) 70%, transparent)"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M0 215 C 50 215, 50 60, 100 60"
              stroke="color-mix(in oklch, var(--rose-500, oklch(0.65 0.22 22)) 70%, transparent)"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M0 165 C 50 165, 50 160, 100 160"
              stroke="color-mix(in oklch, var(--amber-500, oklch(0.78 0.16 75)) 70%, transparent)"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M0 45 C 50 45, 50 260, 100 260"
              stroke="color-mix(in oklch, var(--exolar-cyan) 60%, transparent)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M0 115 C 50 115, 50 260, 100 260"
              stroke="color-mix(in oklch, var(--exolar-cyan) 60%, transparent)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M0 190 C 50 190, 50 260, 100 260"
              stroke="color-mix(in oklch, var(--exolar-cyan) 60%, transparent)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M0 240 C 50 240, 50 260, 100 260"
              stroke="color-mix(in oklch, var(--exolar-cyan) 60%, transparent)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M0 290 C 50 290, 50 260, 100 260"
              stroke="color-mix(in oklch, var(--exolar-cyan) 60%, transparent)"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
          </motion.svg>
        </div>

        {/* Right column — verdict */}
        <div className="flex flex-col justify-center gap-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            <span>triage</span>
            <span className="font-mono lowercase text-[var(--exolar-cyan)]">
              {phase >= 3 ? "done" : phase >= 2 ? "running" : "—"}
            </span>
          </div>

          {VERDICTS.map((v, i) => (
            <motion.div
              key={v.label}
              initial={reduce ? false : { opacity: 0, scale: 0.94 }}
              animate={
                reduce
                  ? undefined
                  : phase >= 3
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.94 }
              }
              transition={{
                duration: 0.6,
                delay: 0.12 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "rounded-lg border bg-background/60 p-3 backdrop-blur",
                v.hue === "fail" && "border-rose-500/30",
                v.hue === "flaky" && "border-amber-500/30",
                v.hue === "pass" && "border-[var(--exolar-cyan)]/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-medium leading-tight">{v.label}</div>
                <div
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    v.hue === "fail" && "text-rose-400",
                    v.hue === "flaky" && "text-amber-400",
                    v.hue === "pass" && "text-[var(--exolar-cyan)]",
                  )}
                >
                  {v.count}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer caption */}
      <div className="absolute inset-x-5 bottom-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground sm:inset-x-7">
        <span>9 tests → 3 verdicts</span>
        <span>~1.5s</span>
      </div>
    </div>
  )
}

function StatusDot({
  status,
  pulse,
}: {
  status: "pass" | "fail" | "flaky"
  pulse?: boolean
}) {
  const color =
    status === "pass"
      ? "bg-[var(--exolar-cyan)]"
      : status === "fail"
        ? "bg-rose-500"
        : "bg-amber-500"
  return (
    <span className="relative flex size-1.5 shrink-0">
      {pulse && (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", color)} />
      )}
      <span className={cn("relative size-1.5 rounded-full", color)} />
    </span>
  )
}
