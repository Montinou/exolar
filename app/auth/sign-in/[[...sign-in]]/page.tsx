import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <SignIn fallbackRedirectUrl="/dashboard" />
      </div>
    </main>
  )
}
