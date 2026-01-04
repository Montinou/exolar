"use client"

import Link from "next/link"
import Image from "next/image"
import { Github, BookOpen } from "lucide-react"
import { WishlistForm } from "./WishlistForm"

export function Footer() {
  return (
    <footer
      className="pt-16 border-t"
      style={{
        background: "var(--deep-void)",
        borderColor: "var(--glass-border)",
      }}
    >
      <div className="container mx-auto px-4">
        {/* Wishlist Section */}
        <div className="max-w-lg mx-auto mb-12 text-center">
          <p
            className="text-lg font-medium mb-2"
            style={{ color: "oklch(0.7 0 0)" }}
          >
            Stay in the loop
          </p>
          <p
            className="text-sm mb-4"
            style={{ color: "oklch(0.5 0 0)" }}
          >
            Get notified about updates and new features
          </p>
          <WishlistForm />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Tagline */}
          <div className="text-center md:text-left">
            <p
              className="text-lg font-medium"
              style={{ color: "oklch(0.7 0 0)" }}
            >
              Built for the{" "}
              <span style={{ color: "var(--safety-amber)" }}>Agentic</span>{" "}
              Future.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="https://github.com/Montinou/e2e-test-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
              style={{ color: "oklch(0.6 0 0)" }}
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
              style={{ color: "oklch(0.6 0 0)" }}
            >
              <BookOpen className="w-4 h-4" />
              <span>Docs</span>
            </Link>
            <Link
              href="/dashboard"
              className="btn-glass text-sm py-2 px-4"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width Logo Banner */}
      <div className="w-full mt-12">
        <Image
          src="/branding/logo-full.png"
          alt="Exolar QA Logo"
          width={2940}
          height={426}
          className="w-full h-auto object-contain"
          priority
        />
      </div>

      {/* Copyright */}
      <div
        className="py-4 text-center text-xs"
        style={{
          background: "var(--deep-void)",
          color: "oklch(0.4 0 0)",
        }}
      >
        <p>&copy; {new Date().getFullYear()} Exolar QA. All rights reserved.</p>
      </div>
    </footer>
  )
}
