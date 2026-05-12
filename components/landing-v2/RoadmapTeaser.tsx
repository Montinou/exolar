"use client"

import { FadeIn, Section } from "./atmosphere"

/**
 * Quiet pre-CTA section. Names the AI triage layer explicitly
 * (per PRODUCT.md: "audience rewards specificity") without overselling.
 * Atmosphere drops here so the CTA's drench reads as a return.
 */
export function RoadmapTeaser() {
  return (
    <Section variant="panel" className="!py-24 sm:!py-28">
      <FadeIn>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[var(--exolar-cyan)]" />
            <span>07 · Next</span>
          </div>
          <p className="mt-7 text-balance text-3xl font-medium leading-[1.18] tracking-[-0.02em] sm:text-4xl">
            AI triage layer is shipping next. <br />
            <span className="text-muted-foreground">
              Every failed run lands in your inbox as a draft post-mortem: clusters, suspects, the
              line of code that&apos;s probably wrong.
            </span>
          </p>
          <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <RoadmapItem state="now" label="Cluster & semantic search" />
            <RoadmapItem state="now" label="Smart selection · shadow" />
            <RoadmapItem state="next" label="Smart selection · active" />
            <RoadmapItem state="next" label="AI triage drafts" />
          </div>
        </div>
      </FadeIn>
    </Section>
  )
}

function RoadmapItem({
  state,
  label,
}: {
  state: "now" | "next" | "later"
  label: string
}) {
  const tag = state === "now" ? "Now" : state === "next" ? "Next" : "Later"
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--exolar-cyan)]">
        {tag}
      </p>
      <p className="mt-2 text-sm leading-snug text-foreground/85">{label}</p>
    </div>
  )
}
