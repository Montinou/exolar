"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { FadeIn, Section } from "./atmosphere"
import { cn } from "@/lib/utils"

/**
 * Signature interactive moment. Hover the diff entries on the left;
 * the right side shows which suites Exolar would skip vs run.
 * Demonstrates Smart Selection without needing the real product.
 */

const SCENARIOS = [
  {
    id: "ui-only",
    diffFiles: ["app/components/Header.tsx", "app/components/Logo.tsx"],
    label: "Header + logo change",
    runs: ["marketplace", "auth"],
    skips: [
      "checkout",
      "search",
      "stream-chat",
      "api-only",
      "smart-selection",
      "admin",
      "settings",
      "reliability",
    ],
    confidence: 0.94,
    reasoning: "Visual-only change. No business logic, no API surfaces, no shared state.",
  },
  {
    id: "checkout",
    diffFiles: ["app/api/checkout/route.ts", "lib/promo/validator.ts"],
    label: "Promo validator refactor",
    runs: ["checkout", "marketplace", "api-only"],
    skips: [
      "auth",
      "search",
      "stream-chat",
      "smart-selection",
      "admin",
      "settings",
      "reliability",
    ],
    confidence: 0.88,
    reasoning: "Touches checkout API + promo logic. Marketplace pulls promos.",
  },
  {
    id: "schema",
    diffFiles: ["migrations/048_add_org_invites.sql", "lib/db/orgs.ts"],
    label: "DB migration · org invites",
    runs: ["all"],
    skips: [],
    confidence: 0.0,
    reasoning: "Schema change. Fans out unpredictably. Running the full suite.",
  },
]

export function SmartSelectionDemo() {
  const [active, setActive] = useState(SCENARIOS[0].id)
  const scenario = SCENARIOS.find((s) => s.id === active)!
  const reduce = useReducedMotion()

  return (
    <Section variant="drench" className="!py-32 sm:!py-40">
      <FadeIn>
        <div className="grid items-end gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              05 · Smart selection
            </p>
            <h2 className="mt-5 max-w-[18ch] text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
              Skip the suites your PR can&apos;t break.
            </h2>
          </div>
          <p className="max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            For each PR, a Gemini-class model reads the diff against your suite catalog and
            recommends what to actually run. Shadow mode first; auto-skip only after calibration.
            Tap a scenario.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <div className="mt-14 grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:gap-6">
          {/* Left — scenarios */}
          <div className="space-y-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                aria-pressed={s.id === active}
                className={cn(
                  "group block w-full rounded-xl border bg-background/70 p-5 text-left transition-all",
                  s.id === active
                    ? "border-[var(--exolar-cyan)]/50 bg-background/80 shadow-[0_0_0_1px_color-mix(in_oklch,var(--exolar-cyan)_30%,transparent),0_8px_28px_-12px_color-mix(in_oklch,var(--exolar-cyan)_50%,transparent)]"
                    : "border-border/50 hover:border-border hover:bg-background/70",
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                  <span>PR scenario</span>
                  <span
                    className={cn(
                      "transition-colors",
                      s.id === active ? "text-[var(--exolar-cyan)]" : "",
                    )}
                  >
                    {s.id === active ? "→ active" : "tap to view"}
                  </span>
                </div>
                <p className="mt-2 text-base font-medium tracking-tight">{s.label}</p>
                <div className="mt-3 space-y-1 font-mono text-[11px] text-foreground/75">
                  {s.diffFiles.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-[var(--exolar-cyan)]/70">+</span>
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Right — recommendation panel */}
          <motion.div
            key={scenario.id}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-xl border border-border/50 bg-background/85 p-6 sm:p-7"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 60% at 100% 0%, color-mix(in oklch, var(--exolar-cyan) 18%, transparent) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <span>recommendation</span>
                <span className="text-[var(--exolar-cyan)]">
                  confidence{" "}
                  <span className="tabular-nums">{scenario.confidence.toFixed(2)}</span>
                </span>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    will run
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scenario.runs.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-[var(--exolar-cyan)]/30 bg-[var(--exolar-cyan)]/[0.08] px-2 py-1 font-mono text-[11px] text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    will skip
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scenario.skips.length === 0 ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        (none)
                      </span>
                    ) : (
                      scenario.skips.map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-border/50 bg-background/40 px-2 py-1 font-mono text-[11px] text-muted-foreground line-through decoration-muted-foreground/40"
                        >
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t border-border/40 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  observation
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {scenario.reasoning}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>mode · shadow</span>
                <span>
                  saved ~{Math.round((scenario.skips.length / 10) * 18)} min · this PR
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </FadeIn>
    </Section>
  )
}
