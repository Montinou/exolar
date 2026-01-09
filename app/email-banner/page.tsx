import { AnimatedBannerEmail } from "@/components/landing/AnimatedBannerEmail"

export default function EmailBannerPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <AnimatedBannerEmail />
      </div>
    </div>
  )
}
