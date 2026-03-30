import { UserProfile } from "@clerk/nextjs"

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6">
        <UserProfile routing="path" path="/account" />
      </div>
    </main>
  )
}
