/**
 * Announcements Data Structure
 * Central configuration for in-app announcement banners
 */

import type { ReactNode } from "react"

export interface Announcement {
  id: string // Unique ID for localStorage tracking
  title: string
  description: string
  ctaText: string
  ctaUrl: string
  icon: ReactNode
  variant: "info" | "feature" | "warning" | "success"
  expiresAt?: Date // Auto-hide after this date
  priority: number // Higher number = show first (1-10)
}

/**
 * Active announcements (shown to users who haven't dismissed them)
 * Add new announcements here - they'll automatically appear in the banner
 */
export const ACTIVE_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ai-vector-search-v23",
    title: "🧠 AI Vector Search - Smart Clustering & Semantic Search",
    description:
      "50+ failures → 3 root causes. Find tests by intent with AI-powered semantic search and clustering.",
    ctaText: "Read Documentation",
    ctaUrl: "/docs/ai-search",
    icon: null,
    variant: "feature",
    expiresAt: new Date("2026-02-20"), // 40 days from launch
    priority: 11, // Highest priority
  },
  {
    id: "integration-engineer-v21",
    title: "🤖 AI-Guided CI/CD Setup",
    description:
      "Claude now guides you through integration with conversational setup. No more config confusion!",
    ctaText: "Try It Now",
    ctaUrl: "/docs/mcp#conversational-setup",
    icon: null,
    variant: "feature",
    expiresAt: new Date("2026-02-15"), // 35 days from launch
    priority: 9,
  },
  {
    id: "mcp-v2-launch",
    title: "🚀 MCP Integration Now Available",
    description:
      "Query your test data directly from Claude Code with 83% fewer tokens and AI-powered insights",
    ctaText: "Read Documentation",
    ctaUrl: "/docs/mcp",
    icon: null, // Icon will be rendered in component
    variant: "feature",
    expiresAt: new Date("2026-02-10"), // 30 days from launch
    priority: 10,
  },
  // Future announcements will be added here...
  // Example:
  // {
  //   id: "reliability-score-launch",
  //   title: "🎯 New Reliability Score Dashboard",
  //   description: "Track your test suite health with a single 0-100 score",
  //   ctaText: "View Dashboard",
  //   ctaUrl: "/dashboard/reliability",
  //   icon: null,
  //   variant: "feature",
  //   expiresAt: new Date("2026-02-15"),
  //   priority: 9,
  // },
]

/**
 * Get active announcements (not expired, sorted by priority)
 */
export function getActiveAnnouncements(): Announcement[] {
  const now = new Date()
  return ACTIVE_ANNOUNCEMENTS.filter((announcement) => {
    // Filter out expired announcements
    if (announcement.expiresAt && announcement.expiresAt < now) {
      return false
    }
    return true
  }).sort((a, b) => b.priority - a.priority) // Higher priority first
}

/**
 * Get specific announcement by ID
 */
export function getAnnouncementById(id: string): Announcement | undefined {
  return ACTIVE_ANNOUNCEMENTS.find((announcement) => announcement.id === id)
}

/**
 * LocalStorage key for dismissed announcements
 */
export const DISMISSED_ANNOUNCEMENTS_KEY = "exolar-dismissed-announcements"

/**
 * Get list of dismissed announcement IDs from localStorage
 */
export function getDismissedAnnouncementIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const dismissed = localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY)
    return dismissed ? JSON.parse(dismissed) : []
  } catch {
    return []
  }
}

/**
 * Mark an announcement as dismissed in localStorage
 */
export function dismissAnnouncement(id: string): void {
  if (typeof window === "undefined") return
  try {
    const dismissed = getDismissedAnnouncementIds()
    if (!dismissed.includes(id)) {
      dismissed.push(id)
      localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(dismissed))
    }
  } catch (error) {
    console.error("Failed to save dismissed announcement:", error)
  }
}

/**
 * Get announcements that should be shown (active and not dismissed)
 */
export function getAnnouncementsToShow(): Announcement[] {
  const active = getActiveAnnouncements()
  const dismissed = getDismissedAnnouncementIds()
  return active.filter((announcement) => !dismissed.includes(announcement.id))
}
