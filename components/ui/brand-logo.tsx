import Image from "next/image"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  variant?: "icon" | "full"
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
  // Default sizes
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
