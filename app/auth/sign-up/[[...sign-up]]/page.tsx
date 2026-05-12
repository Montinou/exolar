import Image from "next/image"
import Link from "next/link"
import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <main className="exolar-vignette flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2.5"
        aria-label="Exolar home"
      >
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

      <div className="w-full max-w-md">
        <SignUp fallbackRedirectUrl="/dashboard" />
      </div>

      <p className="mt-10 max-w-sm text-center text-xs text-muted-foreground">
        New here? Exolar reads your Playwright runs like a senior engineer reads a post-mortem.
      </p>
    </main>
  )
}
