"use client"

import { motion } from "framer-motion"
import { StarfieldCanvas } from "@/components/ui/starfield-canvas"
import { AnimatedLogo } from "@/components/ui/animated-logo"

export function AnimatedBanner() {
  return (
    <div className="relative w-full overflow-hidden h-[200px] md:h-[240px] lg:h-[280px] xl:h-[300px] rounded-xl bg-black border border-white/10 shadow-2xl group isolate">
      {/* Layer 1: Starfield Canvas Background */}
      <StarfieldCanvas numStars={500} />

      {/* Layer 2: Atmospheric Vignette - subtle edge darkening only */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(0,0,0,0.3)_70%,rgba(0,0,0,0.8)_100%)] z-10 pointer-events-none" />

      {/* Layer 3: Side Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-[11]"
        style={{
          background: `linear-gradient(90deg,
            rgba(0,0,0,0.9) 0%,
            transparent 15%,
            transparent 85%,
            rgba(0,0,0,0.9) 100%
          )`,
        }}
      />

      {/* Layer 4: Central Content */}
      <div className="relative z-20 w-full h-full flex flex-col items-center justify-center pt-4">
        {/* Central Glow - breathing animation */}
        <motion.div
          className="absolute inset-0 -m-4"
          style={{
            background: `radial-gradient(circle, oklch(0.78 0.18 75 / 0.15) 0%, transparent 50%)`,
            filter: "blur(20px)",
          }}
          animate={{
            opacity: [1, 0, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Animated Logo with Lightning Effects */}
        <div className="mb-4 md:mb-6 scale-110 md:scale-125">
          <AnimatedLogo size="xl" />
        </div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-none relative z-20"
        >
          {/* Text Shadow */}
          <span
            className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-transparent blur-sm transform translate-y-2 pointer-events-none"
            aria-hidden="true"
          >
            EXOLAR
          </span>
          {/* Main Gradient */}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-200 to-orange-500 drop-shadow-[0_0_25px_rgba(34,211,238,0.2)]">
            EXOLAR
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-2 flex items-center justify-center gap-4 w-full"
        >
          <div className="h-[1px] w-8 md:w-12 bg-gradient-to-r from-transparent via-cyan-900 to-transparent opacity-50" />
          <p className="text-slate-400 text-[10px] md:text-xs font-bold tracking-[0.3em] md:tracking-[0.4em] uppercase">
            Testing Dashboard
          </p>
          <div className="h-[1px] w-8 md:w-12 bg-gradient-to-r from-transparent via-orange-900 to-transparent opacity-50" />
        </motion.div>
      </div>

      {/* Layer 5: Decorative Borders */}
      <div
        className="absolute bottom-0 left-0 w-full h-px z-30"
        style={{
          background:
            "linear-gradient(to right, transparent, oklch(0.75 0.15 195 / 0.5) 50%, transparent)",
        }}
      />
      <div
        className="absolute top-0 left-0 w-full h-px z-30"
        style={{
          background:
            "linear-gradient(to right, transparent, oklch(0.95 0.02 0 / 0.2) 50%, transparent)",
        }}
      />
    </div>
  )
}
