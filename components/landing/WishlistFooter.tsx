"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { StarfieldCanvas } from "@/components/ui/starfield-canvas"

type FormStatus = "idle" | "loading" | "success" | "error"

export function WishlistFooter() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [status, setStatus] = useState<FormStatus>("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error")
      setMessage("Please enter a valid email address")
      return
    }

    setStatus("loading")
    setMessage("")

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus("success")
        setMessage("You're on the list!")
        setEmail("")
        setName("")
      } else {
        setStatus("error")
        setMessage(data.error || "Something went wrong")
      }
    } catch {
      setStatus("error")
      setMessage("Failed to connect. Please try again.")
    }
  }

  return (
    <section className="relative h-[250px] w-full bg-black overflow-hidden">
      {/* Starfield Canvas Background */}
      <StarfieldCanvas numStars={150} />

      {/* Subtle radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.3)_70%,rgba(0,0,0,0.6)_100%)] z-10 pointer-events-none" />

      {/* Top border accent line */}
      <div
        className="absolute top-0 left-0 w-full h-px z-30"
        style={{
          background:
            "linear-gradient(to right, transparent 5%, oklch(0.75 0.15 195 / 0.4) 50%, transparent 95%)",
        }}
      />

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center px-4">
        {/* Message */}
        <p className="text-slate-300 text-lg mb-6 text-center">
          Interested? Leave your details for early access.
        </p>

        {/* Horizontal Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === "loading"}
              className="min-h-[44px] w-full sm:w-auto sm:flex-1 max-w-xs bg-white/5 border-white/10 placeholder:text-white/40 text-white focus-visible:ring-[var(--safety-amber)]/50 focus-visible:border-[var(--safety-amber)]"
            />
            <Input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === "loading"}
              className="min-h-[44px] w-full sm:w-auto sm:max-w-[160px] bg-white/5 border-white/10 placeholder:text-white/40 text-white focus-visible:ring-[var(--safety-amber)]/50 focus-visible:border-[var(--safety-amber)]"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-amber min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Wishlist"
              )}
            </button>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`flex items-center justify-center gap-2 text-sm mt-4 ${
                status === "success"
                  ? "text-green-400"
                  : status === "error"
                    ? "text-red-400"
                    : ""
              }`}
            >
              {status === "success" && <CheckCircle className="w-4 h-4" />}
              {status === "error" && <AlertCircle className="w-4 h-4" />}
              {message}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
