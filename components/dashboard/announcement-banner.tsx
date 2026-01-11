"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { X, Terminal, Sparkles, AlertTriangle, CheckCircle, Info } from "lucide-react"
import { getAnnouncementsToShow, dismissAnnouncement } from "@/lib/announcements/data"
import type { Announcement } from "@/lib/announcements/data"
import { Button } from "@/components/ui/button"

/**
 * Announcement Banner Component
 * Displays in-app notifications with dismissal functionality
 *
 * Features:
 * - Glass-morphism design matching dashboard theme
 * - Gradient accent border
 * - Smooth slide-down animation
 * - LocalStorage persistence for dismissals
 * - Multiple announcement support (shows one at a time)
 * - Auto-dismiss after expiration date
 */
export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [mounted, setMounted] = useState(false)

  // Load announcements after component mounts (client-side only)
  useEffect(() => {
    setMounted(true)
    setAnnouncements(getAnnouncementsToShow())
  }, [])

  const handleDismiss = (id: string) => {
    dismissAnnouncement(id)
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }

  // Don't render during SSR or if no announcements
  if (!mounted || announcements.length === 0) {
    return null
  }

  // Show the first (highest priority) announcement
  const currentAnnouncement = announcements[0]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentAnnouncement.id}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto max-w-7xl">
            <div
              className={`
                relative rounded-lg p-4 sm:p-5
                ${getVariantStyles(currentAnnouncement.variant).background}
                ${getVariantStyles(currentAnnouncement.variant).border}
                backdrop-blur-sm
                shadow-lg
              `}
            >
              {/* Gradient accent border */}
              <div
                className={`absolute inset-0 rounded-lg opacity-30 pointer-events-none
                ${getVariantStyles(currentAnnouncement.variant).gradient}
              `}
                style={{ padding: "1px" }}
              />

              <div className="relative flex items-start gap-3 sm:gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getVariantIcon(currentAnnouncement.variant)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                    {currentAnnouncement.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {currentAnnouncement.description}
                  </p>
                </div>

                {/* CTA Button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={currentAnnouncement.ctaUrl}>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`
                        text-xs font-medium
                        ${getVariantStyles(currentAnnouncement.variant).button}
                        hover:scale-105 transition-transform
                      `}
                    >
                      {currentAnnouncement.ctaText} →
                    </Button>
                  </Link>

                  {/* Dismiss Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-background/50"
                    onClick={() => handleDismiss(currentAnnouncement.id)}
                    aria-label="Dismiss announcement"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Remaining announcements indicator */}
              {announcements.length > 1 && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-xs text-muted-foreground text-center">
                    {announcements.length - 1} more {announcements.length === 2 ? "update" : "updates"} to view
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Get styling classes for each variant
 */
function getVariantStyles(variant: Announcement["variant"]) {
  switch (variant) {
    case "feature":
      return {
        background: "bg-gradient-to-br from-primary/10 via-purple-500/10 to-amber-500/10",
        border: "border border-primary/20",
        gradient: "bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500",
        button: "border-primary/30 hover:border-primary/50 hover:bg-primary/10",
      }
    case "warning":
      return {
        background: "bg-gradient-to-br from-amber-500/10 to-orange-500/10",
        border: "border border-amber-500/20",
        gradient: "bg-gradient-to-r from-amber-500 to-orange-500",
        button: "border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10",
      }
    case "success":
      return {
        background: "bg-gradient-to-br from-green-500/10 to-emerald-500/10",
        border: "border border-green-500/20",
        gradient: "bg-gradient-to-r from-green-500 to-emerald-500",
        button: "border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10",
      }
    case "info":
    default:
      return {
        background: "bg-gradient-to-br from-blue-500/10 to-cyan-500/10",
        border: "border border-blue-500/20",
        gradient: "bg-gradient-to-r from-blue-500 to-cyan-500",
        button: "border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/10",
      }
  }
}

/**
 * Get icon component for each variant
 */
function getVariantIcon(variant: Announcement["variant"]) {
  const iconClass = "h-5 w-5 sm:h-6 sm:w-6"

  switch (variant) {
    case "feature":
      return <Sparkles className={`${iconClass} text-primary`} />
    case "warning":
      return <AlertTriangle className={`${iconClass} text-amber-500`} />
    case "success":
      return <CheckCircle className={`${iconClass} text-green-500`} />
    case "info":
    default:
      return <Info className={`${iconClass} text-blue-500`} />
  }
}
