"use client"

import { useState } from "react"
import { ArrowRight, Check } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { FadeIn, Section } from "./atmosphere"
import { cn } from "@/lib/utils"

type State = "idle" | "submitting" | "success" | "error"

/**
 * Final atmospheric return. Drenched cyan, single email field, single button.
 * Reuses the existing /api/wishlist endpoint (no backend change required).
 */
export function WishlistCTA() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<State>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const reduce = useReducedMotion()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || state === "submitting") return
    setState("submitting")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      setState("success")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't submit. Try again?")
      setState("error")
    }
  }

  return (
    <Section id="wishlist" variant="drench" className="!py-32 sm:!py-40">
      <FadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            08 · Join
          </p>
          <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
            Stop reading red builds. <br />
            <span className="text-muted-foreground">Start reading verdicts.</span>
          </h2>
          <p className="mt-7 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Early access to Exolar is rolling out to platform teams running serious Playwright suites.
          </p>

          <form onSubmit={submit} className="relative mx-auto mt-12 max-w-md">
            <motion.div
              animate={
                reduce
                  ? undefined
                  : state === "success"
                    ? { scale: [1, 1.02, 1] }
                    : undefined
              }
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "flex h-14 items-center rounded-xl border bg-background/85 pl-5 pr-1.5 transition-colors",
                state === "success"
                  ? "border-[var(--exolar-cyan)]/60"
                  : state === "error"
                    ? "border-rose-500/60"
                    : "border-border/70 focus-within:border-[var(--exolar-cyan)]/60",
              )}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === "submitting" || state === "success"}
                placeholder="you@team.com"
                className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={state === "submitting" || state === "success" || !email}
                className={cn(
                  "inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium transition-all",
                  state === "success"
                    ? "bg-[var(--exolar-cyan)] text-[var(--exolar-cyan-foreground)]"
                    : "bg-[var(--exolar-cyan)] text-[var(--exolar-cyan-foreground)] hover:scale-[1.02] hover:shadow-[0_0_28px_color-mix(in_oklch,var(--exolar-cyan)_60%,transparent)] disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-none",
                )}
              >
                {state === "success" ? (
                  <>
                    <Check className="mr-1.5 size-4" /> You&apos;re in
                  </>
                ) : state === "submitting" ? (
                  "Submitting…"
                ) : (
                  <>
                    Join
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                )}
              </button>
            </motion.div>

            <div className="mt-3 min-h-[1.25rem] text-xs">
              {state === "success" && (
                <span className="text-[var(--exolar-cyan)]">
                  Thanks. We&apos;ll be in touch when your tier opens up.
                </span>
              )}
              {state === "error" && errorMsg && (
                <span className="text-rose-400">{errorMsg}</span>
              )}
            </div>
          </form>
        </div>
      </FadeIn>
    </Section>
  )
}
