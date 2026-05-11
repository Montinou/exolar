"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"

export function LandingNav() {
  const { scrollY } = useScroll()
  const blur = useTransform(scrollY, [0, 120], [0, 12])
  const borderOpacity = useTransform(scrollY, [0, 120], [0, 0.6])

  return (
    <motion.nav
      className="fixed inset-x-0 top-0 z-50"
      style={{
        backdropFilter: blur.get() > 0 ? `blur(${blur.get()}px)` : undefined,
      }}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px bg-border/60"
        style={{ opacity: borderOpacity }}
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/branding/logo-icon.png"
            alt=""
            width={28}
            height={28}
            className="size-7"
            priority
          />
          <span className="text-base font-semibold tracking-tight">Exolar</span>
        </Link>

        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/docs"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="#wishlist"
            className="ml-2 inline-flex h-9 items-center rounded-md bg-[var(--exolar-cyan)] px-4 text-sm font-medium text-[var(--exolar-cyan-foreground)] transition-[transform,box-shadow] hover:scale-[1.02] hover:shadow-[0_0_32px_color-mix(in_oklch,var(--exolar-cyan)_55%,transparent)]"
          >
            Join wishlist
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}
