"use client"

import { motion, useReducedMotion } from "framer-motion"
import { FadeIn, Section } from "./atmosphere"
import { cn } from "@/lib/utils"

/**
 * Three-act mechanism reveal: ingest → cluster → triage.
 *
 * Each act is a vertical block with alternating layout (text-left/right).
 * The visual is an abstracted product surface — not a screenshot, but
 * specific enough to feel real. (Real screenshots come once we have
 * shareable hi-fi captures of the actual dashboard.)
 *
 * Atmosphere returns mid-section via the second act's panel.
 */

const ACTS = [
  {
    n: "02",
    eyebrow: "Ingest",
    title: "Every run, every retry, every artifact.",
    body: "One GitHub Action drops Playwright JSON, traces, videos, and screenshots into Exolar. Multi-tenant by default: your org, repo, branch, suite, run. Vector embeddings get computed at ingest, not on read.",
    visual: <IngestVisual />,
    align: "left" as const,
  },
  {
    n: "03",
    eyebrow: "Cluster",
    title: "Failures group themselves.",
    body: "Jina-v3 embeddings + Cohere reranking pull together failures that share a root cause, even when stack traces differ. Fifty reds become four clusters. Each cluster carries the smallest spanning example that explains the rest.",
    visual: <ClusterVisual />,
    align: "right" as const,
  },
  {
    n: "04",
    eyebrow: "Triage",
    title: "A debrief, not a dashboard.",
    body: "Every run produces a narrative report: what changed, what flaked, what was safely skipped by Smart Selection. The AI triage layer (shipping soon) turns those clusters into a draft post-mortem you can send.",
    visual: <TriageVisual />,
    align: "left" as const,
  },
]

export function MechanismReveal() {
  return (
    <Section id="mechanism" variant="quiet" className="!py-24 sm:!py-32">
      <FadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            How Exolar reads CI
          </p>
          <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
            Three passes between push and verdict.
          </h2>
        </div>
      </FadeIn>

      <div className="mt-24 space-y-32 sm:mt-32 sm:space-y-40">
        {ACTS.map((act, i) => (
          <Act key={act.n} {...act} index={i} />
        ))}
      </div>
    </Section>
  )
}

function Act({
  n,
  eyebrow,
  title,
  body,
  visual,
  align,
}: {
  n: string
  eyebrow: string
  title: string
  body: string
  visual: React.ReactNode
  align: "left" | "right"
  index: number
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-12 lg:gap-16",
        "lg:grid-cols-2",
      )}
    >
      <FadeIn
        className={cn(align === "right" ? "lg:order-2" : "lg:order-1")}
      >
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-sm tabular-nums text-[var(--exolar-cyan)]">{n}</span>
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </span>
          </div>
          <h3 className="mt-5 max-w-[18ch] text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            {title}
          </h3>
          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            {body}
          </p>
        </div>
      </FadeIn>

      <FadeIn
        delay={0.1}
        className={cn(align === "right" ? "lg:order-1" : "lg:order-2")}
      >
        {visual}
      </FadeIn>
    </div>
  )
}

/* ─────── Act visuals ─────── */

function IngestVisual() {
  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border/50 bg-background/40 sm:h-[400px]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 100% 0%, color-mix(in oklch, var(--exolar-cyan) 12%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative grid h-full grid-cols-[1.1fr_1fr] gap-0">
        {/* Left — incoming stream of artifacts */}
        <div className="space-y-2 overflow-hidden border-r border-border/40 p-5">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            incoming
          </div>
          {[
            { type: "json", label: "playwright-results.json", weight: 184 },
            { type: "trace", label: "trace · checkout.spec", weight: 2200 },
            { type: "video", label: "video · marketplace.spec", weight: 4100 },
            { type: "screenshot", label: "screenshot · auth.spec", weight: 380 },
            { type: "json", label: "smart-selection-outcomes.json", weight: 12 },
            { type: "trace", label: "trace · search.spec", weight: 1800 },
          ].map((row, i) => (
            <FlowRow key={i} {...row} delay={i * 0.15} />
          ))}
        </div>
        {/* Right — stored & indexed */}
        <div className="p-5">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            indexed
          </div>
          <div className="space-y-3">
            <Stat label="org_suites" value="14" />
            <Stat label="test_results · 7d" value="48,512" />
            <Stat label="failures embedded" value="2,118" />
            <Stat label="vector dim" value="1024" />
          </div>
        </div>
      </div>
    </div>
  )
}

function FlowRow({
  type,
  label,
  weight,
  delay,
}: {
  type: string
  label: string
  weight: number
  delay: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -16 }}
      whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-between gap-3 rounded-md border border-border/30 bg-background/40 px-2.5 py-1.5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--exolar-cyan)]">
          {type}
        </span>
        <span className="truncate font-mono text-[11px] text-foreground/80">{label}</span>
      </div>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {weight > 1000 ? `${(weight / 1000).toFixed(1)}kb` : `${weight}b`}
      </span>
    </motion.div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/30 pb-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-base font-medium tabular-nums tracking-tight">{value}</span>
    </div>
  )
}

function ClusterVisual() {
  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border/50 bg-background/40 sm:h-[400px]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 0% 100%, color-mix(in oklch, var(--exolar-cyan) 16%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative h-full p-5">
        <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>50 failures · 4 clusters</span>
          <span className="text-[var(--exolar-cyan)]">jina-v3 · cohere rerank</span>
        </div>
        <div className="space-y-3">
          {[
            { name: "Checkout promo path", count: 18, severity: "high" as const, accent: "rose" },
            { name: "Stream chat reconnect", count: 14, severity: "high" as const, accent: "rose" },
            { name: "Algolia debounce race", count: 11, severity: "med" as const, accent: "amber" },
            { name: "Long-tail singletons", count: 7, severity: "low" as const, accent: "neutral" },
          ].map((c, i) => (
            <ClusterRow key={c.name} {...c} delay={i * 0.12} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ClusterRow({
  name,
  count,
  severity,
  accent,
  delay,
}: {
  name: string
  count: number
  severity: "high" | "med" | "low"
  accent: "rose" | "amber" | "neutral"
  delay: number
}) {
  const reduce = useReducedMotion()
  const pct = (count / 18) * 100
  const accentColor =
    accent === "rose"
      ? "bg-rose-500/50"
      : accent === "amber"
        ? "bg-amber-500/50"
        : "bg-muted-foreground/40"
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium tracking-tight">{name}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {count} · {severity}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border/40">
        <motion.div
          initial={reduce ? false : { width: 0 }}
          whileInView={reduce ? undefined : { width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
          className={cn("h-full", accentColor)}
        />
      </div>
    </motion.div>
  )
}

function TriageVisual() {
  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border/50 bg-background/40 sm:h-[400px]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, color-mix(in oklch, var(--exolar-cyan) 14%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex h-full flex-col p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>triage report · CI #2871</span>
          <span className="text-[var(--exolar-cyan)]">draft · ready to send</span>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium tracking-tight">Headline</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Checkout promo path broke when the new pricing API rolled out at <span className="font-mono text-foreground">18:42 UTC</span>. Smart Selection correctly skipped 11 unaffected suites this PR.
            </p>
          </div>
          <div>
            <p className="font-medium tracking-tight">What changed</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              <span className="font-mono text-foreground">apps/pricing/v3</span> shipped; promo-code locator selector drifted.
            </p>
          </div>
          <div>
            <p className="font-medium tracking-tight">Recommended action</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Update <span className="font-mono text-foreground">checkout/promo-code.spec.ts:48</span> locator.{" "}
              <span className="text-[var(--exolar-cyan)]">→ Open PR</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
