"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { motion } from "framer-motion"

interface StarProps {
  delay: number
  x: number
  y: number
  size: number
  color: string
  duration: number
}

interface ShootingStarData {
  delay: number
  startY: number
  repeatDelay: number
}

// Componente para una estrella parpadeante
const TwinklingStar = ({ delay, x, y, size, color, duration }: StarProps) => (
  <motion.div
    initial={{ opacity: 0.2, scale: 0.5 }}
    animate={{
      opacity: [0.2, 1, 0.2],
      scale: [0.5, 1.2, 0.5],
    }}
    transition={{
      duration,
      repeat: Infinity,
      delay: delay,
      ease: "easeInOut",
    }}
    style={{
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      backgroundColor: color,
      boxShadow: `0 0 ${size * 4}px ${size}px ${color}`,
    }}
    className="absolute rounded-full z-10 pointer-events-none"
  />
)

// Componente para una estrella fugaz
const ShootingStar = ({ startY, repeatDelay }: { startY: number; repeatDelay: number }) => (
  <motion.div
    initial={{ x: "-10%", y: `${startY}%`, opacity: 0, scale: 0.5 }}
    animate={{
      x: "150%",
      y: `${startY + 20}%`,
      opacity: [0, 1, 1, 0],
      scale: 1,
    }}
    transition={{
      duration: 2.5,
      ease: "easeIn",
      repeat: Infinity,
      repeatDelay,
    }}
    className="absolute z-10 w-32 h-0.5 pointer-events-none rotate-12"
    style={{
      background:
        "linear-gradient(to right, transparent, oklch(0.95 0.02 0), transparent)",
    }}
  />
)

export function AnimatedBanner() {
  // Generate stars only on client to avoid hydration mismatch
  const [stars, setStars] = useState<StarProps[]>([])
  const [shootingStars, setShootingStars] = useState<ShootingStarData[]>([])

  useEffect(() => {
    // Generate twinkling stars on client only
    const generatedStars = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.pow(Math.random(), 1.5) * 100,
      size: Math.random() > 0.8 ? 3 : 2,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      color:
        i % 7 === 0
          ? "oklch(0.85 0.12 195)" // cyan
          : i % 7 === 1
            ? "oklch(0.88 0.15 75)" // amber
            : i % 7 === 2
              ? "oklch(0.70 0.20 280)" // purple
              : "oklch(0.95 0.02 0)", // white
    }))
    setStars(generatedStars)

    // Generate shooting stars on client only
    const generatedShootingStars = [0, 3, 7].map((delay) => ({
      delay,
      startY: Math.random() * 50,
      repeatDelay: Math.random() * 10 + 5 + delay,
    }))
    setShootingStars(generatedShootingStars)
  }, [])

  return (
    <div className="relative w-full overflow-hidden h-[200px] md:h-[240px] lg:h-[280px] xl:h-[300px] group bg-[oklch(0.08_0.02_260)]">
      {/* Capa 1: Fondo con imagen */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/branding/background-no-logo.png"
          alt="Exolar Cosmic Background"
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover object-center scale-105 group-hover:scale-110 transition-transform duration-[20s] ease-linear"
        />
        {/* Overlay degradado para oscurecer y asegurar legibilidad */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              oklch(0.05 0.02 260 / 0.5) 0%,
              oklch(0.05 0.02 260 / 0.35) 30%,
              oklch(0.05 0.02 260 / 0.35) 60%,
              oklch(0.05 0.02 260 / 0.7) 100%
            )`,
          }}
        />
        {/* Tinte cósmico sutil */}
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            background: "oklch(0.3 0.1 260 / 0.15)",
          }}
        />
      </div>

      {/* Capa 2: Vignette lateral */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: `linear-gradient(90deg,
            oklch(0.06 0.02 260) 0%,
            transparent 15%,
            transparent 85%,
            oklch(0.06 0.02 260) 100%
          )`,
        }}
      />

      {/* Capa 3: Estrellas animadas */}
      <div className="absolute inset-0 z-10 overflow-hidden">
        {stars.map((star, i) => (
          <TwinklingStar key={i} {...star} />
        ))}
        {/* Estrellas fugaces */}
        {shootingStars.map((star, i) => (
          <ShootingStar key={i} startY={star.startY} repeatDelay={star.repeatDelay} />
        ))}
      </div>

      {/* Capa 4: Contenido central */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-4">
        {/* Glow central */}
        <div
          className="absolute inset-0 -m-4"
          style={{
            background: `radial-gradient(circle, oklch(0.78 0.18 75 / 0.15) 0%, transparent 50%)`,
            filter: "blur(20px)",
          }}
        />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "backOut" }}
          className="relative"
        >
          {/* Logo con efecto de flotación */}
          <div className="relative">
            <div
              className="absolute inset-0 -m-4"
              style={{
                background: `radial-gradient(circle, oklch(0.78 0.18 75 / 0.3) 0%, transparent 70%)`,
                filter: "blur(15px)",
              }}
            />
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/branding/logo-icon.png"
                alt="Exolar"
                width={80}
                height={80}
                className="relative z-10"
                style={{
                  filter: "drop-shadow(0 0 25px oklch(0.78 0.18 75 / 0.5))",
                }}
                priority
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Texto de marca con Glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-center mt-3 relative"
        >
          {/* Glow de fondo detrás del texto */}
          <div
            className="absolute inset-0 -m-8"
            style={{
              background: "radial-gradient(ellipse at center, oklch(0.5 0.15 195 / 0.4) 0%, oklch(0.4 0.1 75 / 0.2) 40%, transparent 70%)",
              filter: "blur(25px)",
            }}
          />

          {/* "Exolar" - gradiente HORIZONTAL cyan → naranja con glow */}
          <h1
            className="text-5xl md:text-6xl relative"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              fontWeight: 800,
              background:
                "linear-gradient(90deg, oklch(0.75 0.15 195) 0%, oklch(0.78 0.18 75) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 15px oklch(0.6 0.15 195 / 0.5)) drop-shadow(0 0 30px oklch(0.6 0.15 75 / 0.3))",
            }}
          >
            Exolar
          </h1>
          {/* "Testing Dashboard" - plateado con glow azul intenso */}
          <p
            className="text-lg md:text-xl tracking-[0.2em] mt-1 relative"
            style={{
              color: "oklch(0.85 0.03 220)",
              fontWeight: 600,
              textShadow: "0 0 10px oklch(0.7 0.15 195 / 0.8), 0 0 25px oklch(0.6 0.15 195 / 0.5), 0 0 50px oklch(0.5 0.12 195 / 0.3)",
            }}
          >
            Testing Dashboard
          </p>
        </motion.div>
      </div>

      {/* Capa 5: Bordes decorativos futuristas */}
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
