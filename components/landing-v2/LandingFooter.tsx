import Image from "next/image"
import Link from "next/link"

export function LandingFooter() {
  return (
    <footer className="border-t border-border/40 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/branding/logo-icon.png"
            alt=""
            width={24}
            height={24}
            className="size-6"
          />
          <span className="text-sm font-medium tracking-tight">Exolar QA</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            v0.7 · pre-launch
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <Link href="/docs/mcp" className="transition-colors hover:text-foreground">
            MCP
          </Link>
          <Link href="/auth/sign-in" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <a
            href="https://github.com/Montinou/exolar"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
