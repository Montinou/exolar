import Link from "next/link"
import { Github, BookOpen } from "lucide-react"

export function Footer() {
  return (
    <footer
      className="py-16 border-t"
      style={{
        background: "var(--deep-void)",
        borderColor: "var(--glass-border)",
      }}
    >
      <div className="container mx-auto px-4">
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
            <p
              className="text-sm mt-1"
              style={{ color: "oklch(0.5 0 0)" }}
            >
              E2E Test Dashboard
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
              style={{ color: "oklch(0.6 0 0)" }}
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </Link>
            <Link
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
              style={{ color: "oklch(0.6 0 0)" }}
            >
              <BookOpen className="w-4 h-4" />
              <span>MCP Docs</span>
            </Link>
            <Link
              href="/dashboard"
              className="btn-glass text-sm py-2 px-4"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div
          className="mt-12 pt-8 border-t text-center text-xs"
          style={{
            borderColor: "var(--glass-border)",
            color: "oklch(0.4 0 0)",
          }}
        >
          <p>&copy; {new Date().getFullYear()} E2E Test Dashboard. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
