import { AuthView } from "@neondatabase/auth/react/ui"

export const dynamicParams = false

export function generateStaticParams() {
  return [
    { path: "sign-in" },
    { path: "sign-up" },
    { path: "sign-out" },
    { path: "email-otp" },
    { path: "forgot-password" },
    { path: "reset-password" },
  ]
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <AuthView path={path} />
      </div>
    </main>
  )
}
