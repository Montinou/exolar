"use client"

import { motion } from "framer-motion"
import { StarfieldCanvas } from "@/components/ui/starfield-canvas"
import { AnimatedLogo } from "@/components/ui/animated-logo"

/**
 * Optimized banner for email GIF recording
 * - Taller height for better logo visibility
 * - Less black space / vignette
 * - Bigger logo and text
 * - Better aspect ratio for emails
 */
export function AnimatedBannerEmail() {
  return (
    <div className="relative w-full overflow-hidden h-[400px] rounded-xl bg-black border border-cyan-900/20 shadow-2xl group isolate">
      {/* Layer 1: Starfield Canvas Background - more stars for visual interest */}
      <StarfieldCanvas numStars={600} />

      {/* Layer 2: Subtle vignette - less aggressive than landing page */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_0%,rgba(0,0,0,0.15)_60%,rgba(0,0,0,0.5)_100%)] z-10 pointer-events-none" />

      {/* Layer 3: Very subtle side vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-[11]"
        style={{
          background: `linear-gradient(90deg,
            rgba(0,0,0,0.5) 0%,
            transparent 10%,
            transparent 90%,
            rgba(0,0,0,0.5) 100%
          )`,
        }}
      />

      {/* Layer 4: Central Content - centered with more space */}
      <div className="relative z-20 w-full h-full flex flex-col items-center justify-center">
        {/* Central Glow - breathing animation, full fade */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 45%, oklch(0.78 0.18 75 / 0.25) 0%, transparent 45%)`,
            filter: "blur(30px)",
          }}
          animate={{
            opacity: [1, 0, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Animated Logo - bigger scale for email */}
        <div className="mb-6 scale-150">
          <AnimatedLogo size="xl" />
        </div>

        {/* Main Title - bigger for email */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-7xl font-black tracking-tighter leading-none relative z-20"
        >
          {/* Main Gradient */}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-200 to-orange-500 drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]">
            EXOLAR
          </span>
        </motion.h1>

        {/* Subtitle - bigger spacing */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-4 flex items-center justify-center gap-6 w-full"
        >
          <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-700 to-transparent opacity-60" />
          <p className="text-slate-300 text-sm font-bold tracking-[0.4em] uppercase">
            Testing Dashboard
          </p>
          <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-orange-700 to-transparent opacity-60" />
        </motion.div>
      </div>

      {/* Layer 5: Decorative Borders - more visible */}
      <div
        className="absolute bottom-0 left-0 w-full h-px z-30"
        style={{
          background:
            "linear-gradient(to right, transparent 5%, oklch(0.75 0.15 195 / 0.6) 50%, transparent 95%)",
        }}
      />
    </div>
  )
}
