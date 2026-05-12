"use client"

import { FadeIn, Section } from "./atmosphere"

/**
 * The "your CI is talking, nobody's listening" section.
 * Editorial, reading-first. Two real-ish log snippets as evidence.
 * Atmosphere here is intentionally quiet — recovers from hero's drench.
 */
export function ProblemSection() {
  return (
    <Section variant="quiet" className="!py-32 sm:!py-40">
      <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <FadeIn>
          <div className="sticky top-32">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              01 · the problem
            </p>
            <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
              Your CI is talking. <br />
              <span className="text-muted-foreground">Nobody&apos;s reading.</span>
            </h2>
            <p className="mt-7 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every red build dumps the same kind of noise: thousands of lines of stack traces, retry counts, screenshots, a tight little Slack
              ping. Engineers grep, blame, re-run. The signal is buried under the form factor.
            </p>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              Test analytics tools were built to <em className="not-italic font-medium text-foreground">store</em> this output, not to{" "}
              <em className="not-italic font-medium text-foreground">read</em> it.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="space-y-6">
            <LogSnippet
              caption="CI #2871 · marketplace-v2/checkout.spec.ts"
              status="Failed · 4 retries"
              lines={[
                "  Error: Timed out 30000ms waiting for expect(locator).toBeVisible()",
                "",
                "  Locator: getByRole('button', { name: 'Apply promo' })",
                "  Expected: visible",
                "  Received: <element(s) not found>",
                "",
                "    at /tests/checkout/promo-code.spec.ts:48:34",
                "    at /tests/checkout/promo-code.spec.ts:12:16",
                "",
                "  Retry 1/3 · failed",
                "  Retry 2/3 · failed",
                "  Retry 3/3 · failed",
              ]}
            />
            <LogSnippet
              caption="CI #2871 · 41 lines later"
              status="Failed · 0 retries"
              lines={[
                "  Error: Timed out 30000ms waiting for expect(locator).toBeVisible()",
                "  Locator: getByRole('button', { name: 'Apply promo' })",
                "",
                "  ...identical stack...",
                "",
                "  (no retries, bailed)",
              ]}
              dim
            />
            <p className="px-1 text-sm text-muted-foreground">
              Same root cause, surfaced as two separate failures. A human reads this in five seconds.
              The dashboard doesn&apos;t.
            </p>
          </div>
        </FadeIn>
      </div>
    </Section>
  )
}

function LogSnippet({
  caption,
  status,
  lines,
  dim,
}: {
  caption: string
  status: string
  lines: string[]
  dim?: boolean
}) {
  return (
    <div className={dim ? "opacity-70" : undefined}>
      <div className="flex items-center justify-between border-b border-border/50 px-4 pb-2.5 pt-3 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
        <span className="truncate">{caption}</span>
        <span className="text-rose-400/90">{status}</span>
      </div>
      <pre className="overflow-x-auto rounded-b-md border border-t-0 border-border/50 bg-background/50 px-4 py-3 font-mono text-[12px] leading-[1.65] text-foreground/85">
        <code>
          {lines.map((line, i) => (
            <div key={i}>{line || " "}</div>
          ))}
        </code>
      </pre>
    </div>
  )
}
