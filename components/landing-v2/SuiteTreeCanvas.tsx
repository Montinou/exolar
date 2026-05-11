"use client"

import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Hero visual: an animated, abstracted post-mortem view.
 *
 * Layout maths (so lines align to rows/cards at any container height):
 *   Body is a single 3-column grid (h=full). Both columns use grid-rows-N with
 *   items-center, so row/card centers land at (k − 0.5)/N of the body height.
 *   The SVG uses viewBox 100x320 with preserveAspectRatio="none", so the same
 *   proportional positions map to:
 *     left (9 rows):  y = (k − 0.5)/9 × 320  → 18, 53, 89, 124, 160, 196, 231, 267, 302
 *     right (3 cards): y = (k − 0.5)/3 × 320 → 53, 160, 267
 *   Line endpoints below use those exact Y values.
 *
 * What it shows in ~7s:
 *   1. Suite/test rows materialize (the raw CI signal).
 *   2. Failure nodes pulse and cluster — lines connect related fails.
 *   3. Verdict cards condense the 9 rows into 3 triage outcomes.
 *
 * Respects prefers-reduced-motion (renders the final state immediately).
 */

const TESTS = [
  { name: "marketplace › sort by recent", status: "pass" }, // → safe   (y 18)
  { name: "checkout › apply promo code", status: "fail" }, // → cluster (y 53)
  { name: "auth › reset password", status: "pass" }, // → safe   (y 89)
  { name: "checkout › split shipping", status: "fail" }, // → cluster (y 124)
  { name: "search › fuzzy results", status: "flaky" }, // → flake   (y 160)
  { name: "marketplace › filter chips", status: "pass" }, // → safe   (y 196)
  { name: "checkout › refund flow", status: "fail" }, // → cluster (y 231)
  { name: "auth › sso callback", status: "pass" }, // → safe   (y 267)
  { name: "search › empty state", status: "pass" }, // → safe   (y 302)
] as const

const VERDICTS = [
  { label: "Cluster · Checkout promo path", count: 3, hue: "fail" as const }, // y 53
  { label: "Flake · network timing", count: 1, hue: "flaky" as const }, // y 160
  { label: "Safe · 5 suites · skippable", count: 5, hue: "pass" as const }, // y 267
]

// Y positions on SVG canvas (viewBox 0 0 100 320). Match grid-rows mathematics.
const ROW_Y = [18, 53, 89, 124, 160, 196, 231, 267, 302] as const
const CARD_Y = [53, 160, 267] as const

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

      <div className="relative flex h-full flex-col gap-3">
        {/* Header row — sits above the body grid, columns 1/3 match body columns */}
        <div className="grid grid-cols-[1fr_4rem_1fr] gap-3 sm:grid-cols-[1fr_5rem_1fr] sm:gap-5">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>raw · CI run #2871</span>
            <span className="size-1.5 rounded-full bg-[var(--exolar-cyan)] opacity-70" />
          </div>
          <div aria-hidden />
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>triage</span>
            <span className="font-mono lowercase text-[var(--exolar-cyan)]">
              {phase >= 3 ? "done" : phase >= 2 ? "running" : "—"}
            </span>
          </div>
        </div>

        {/* Body — three columns sharing the same vertical coordinate space */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_4rem_1fr] gap-3 pb-6 sm:grid-cols-[1fr_5rem_1fr] sm:gap-5">
          {/* Left — 9 rows evenly spread across full body height */}
          <div className="grid grid-rows-9 items-center">
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
                <StatusDot
                  status={t.status}
                  pulse={phase === 2 && t.status !== "pass"}
                />
                <span className="truncate">{t.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Middle — SVG of converging curves. preserveAspectRatio=none lets y
              map proportionally to body height; viewBox 100x320 + grid-rows mathematics
              ensure endpoints (53 / 160 / 267) land on the centers of the three
              right-column cards, and sources (18..302) land on the nine left rows. */}
          <div className="relative">
            <motion.svg
              viewBox="0 0 100 320"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              initial={false}
              animate={{ opacity: phase >= 2 ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Cluster (red) — fail rows 2/4/7 → card 1 (y=53) */}
              {([1, 3, 6] as const).map((i) => (
                <path
                  key={`fail-${i}`}
                  d={`M0 ${ROW_Y[i]} C 50 ${ROW_Y[i]}, 50 ${CARD_Y[0]}, 100 ${CARD_Y[0]}`}
                  stroke="color-mix(in oklch, oklch(0.65 0.22 22) 70%, transparent)"
                  strokeWidth="1.4"
                  fill="none"
                />
              ))}
              {/* Flake (amber) — flaky row 5 → card 2 (y=160) */}
              <path
                d={`M0 ${ROW_Y[4]} C 50 ${ROW_Y[4]}, 50 ${CARD_Y[1]}, 100 ${CARD_Y[1]}`}
                stroke="color-mix(in oklch, oklch(0.78 0.16 75) 70%, transparent)"
                strokeWidth="1.4"
                fill="none"
              />
              {/* Safe (cyan) — pass rows 1/3/6/8/9 → card 3 (y=267) */}
              {([0, 2, 5, 7, 8] as const).map((i) => (
                <path
                  key={`pass-${i}`}
                  d={`M0 ${ROW_Y[i]} C 50 ${ROW_Y[i]}, 50 ${CARD_Y[2]}, 100 ${CARD_Y[2]}`}
                  stroke="color-mix(in oklch, var(--exolar-cyan) 60%, transparent)"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.7"
                />
              ))}
            </motion.svg>
          </div>

          {/* Right — 3 verdict cards evenly spread, centers align with line endpoints */}
          <div className="grid grid-rows-3 items-center">
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
      </div>

      {/* Footer caption — absolute so it doesn't perturb the alignment grid */}
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
        <span
          className={cn("absolute inset-0 animate-ping rounded-full opacity-60", color)}
        />
      )}
      <span className={cn("relative size-1.5 rounded-full", color)} />
    </span>
  )
}
