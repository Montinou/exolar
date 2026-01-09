import Image from "next/image"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  variant?: "icon" | "full" | "header"
  className?: string
  width?: number
  height?: number
}

export function BrandLogo({
  variant = "icon",
  className,
  width,
  height
}: BrandLogoProps) {
  // Header variant - banner at top (constrained height)
  if (variant === "header") {
    return (
      <div className={cn("relative w-full max-h-32 overflow-hidden flex items-center justify-center py-4", className)}>
        <Image
          src="/branding/logo-header.png"
          alt="Exolar E2E Dashboard"
          width={600}
          height={150}
          className="h-24 w-auto object-contain"
          priority
        />
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
