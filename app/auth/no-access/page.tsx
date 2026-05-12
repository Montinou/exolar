import Image from "next/image"
import Link from "next/link"
import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

/**
 * Reached when a user has a valid Clerk session BUT no matching row in
 * `dashboard_users`, or no `default_org_id` assigned. The previous code
 * redirected such users to /auth/sign-in, but Clerk would immediately
 * redirect them back to /dashboard (active session) and we'd loop.
 *
 * This page is deliberately a *terminal* state: no auto-redirect, no
 * protected-route framing. The user either retries (after an admin
 * provisions them) or signs out.
 */
export default function NoAccessPage() {
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

      <div className="surface-raised w-full max-w-md p-8">
        <p className="page-eyebrow">No workspace access</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Your account isn&apos;t in an organization yet.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          You&apos;re signed in to Exolar, but no workspace has been provisioned for you. Ask
          your organization admin to add you, or sign out and use a different account.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <SignOutButton redirectUrl="/">
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </div>
      </div>

      <p className="mt-10 max-w-sm text-center text-xs text-muted-foreground">
        If you think this is a mistake, email{" "}
        <Link
          href="mailto:hello@exolar.agentical.work"
          className="text-foreground underline-offset-4 hover:underline"
        >
          hello@exolar.agentical.work
        </Link>
        .
      </p>
    </main>
  )
}
