import Image from "next/image"
import { cn } from "@/lib/utils"
import { AnimatedLogo } from "./animated-logo"

interface BrandLogoProps {
  variant?: "icon" | "full" | "header" | "animated-icon"
  className?: string
  width?: number
  height?: number
  animated?: boolean
}

export function BrandLogo({
  variant = "icon",
  className,
  width,
  height,
  animated = true
}: BrandLogoProps) {
  // Header variant - full width banner with constrained height
  if (variant === "header") {
    return (
      <div className={cn("relative w-full", className)}>
        <Image
          src="/branding/logo-header-v2.png"
          alt="Exolar E2E Dashboard"
          width={1920}
          height={200}
          className="w-full h-auto max-h-40 object-cover object-center"
          priority
        />
      </div>
    )
  }

  // Animated icon variant - uses AnimatedLogo component with lightning effects
  if (variant === "animated-icon") {
    const size = width || 32
    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <AnimatedLogo size={size} animated={animated} />
      </div>
    )
  }

  // Default sizes for icon and full variants
  const defaultSize = variant === "icon" ? 32 : 120
  const w = width || defaultSize
  const h = height || (variant === "icon" ? defaultSize : defaultSize / 3) // approximate aspect ratio for full logo

  return (
    <div className={cn("relative inline-block", className)}>
      <Image
        src={variant === "icon" ? "/branding/logo-icon.png" : "/branding/logo-full.png"}
        alt="Exolar Logo"
        width={w}
        height={h}
        className={cn(
          "object-contain",
          variant === "icon" ? "rounded-full" : ""
        )}
        priority
      />
    </div>
  )
}
