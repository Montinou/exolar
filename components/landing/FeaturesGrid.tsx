"use client"

import { Activity, TrendingUp, AlertTriangle, Clock, LayoutDashboard, GitCompare } from "lucide-react"

// Row 1: Most valuable features (3 items)
const topFeatures = [
  {
    icon: Activity,
    title: "Reliability Score",
    description: "Single 0-100 gauge showing test suite health at a glance. Know instantly if your tests are reliable.",
    iconColor: "var(--exolar-cyan)",
    bgColor: "oklch(0.75 0.15 195 / 0.15)",
  },
  {
    icon: TrendingUp,
    title: "Regression Detection",
    description: "Automatic detection when tests slow down. Catch performance regressions before they impact your CI/CD pipeline.",
    iconColor: "oklch(0.65 0.2 25)",
    bgColor: "oklch(0.65 0.2 25 / 0.15)",
  },
  {
    icon: AlertTriangle,
    title: "Flake Detection",
    description: "Automatically identify flaky tests with statistical analysis. Stop chasing false failures.",
    iconColor: "var(--safety-amber)",
    bgColor: "oklch(0.78 0.18 75 / 0.15)",
  },
]

// Row 2: Supporting features (3 items)
const bottomFeatures = [
  {
    icon: GitCompare,
    title: "Compare Runs",
    description: "Side-by-side comparison of test runs. Instantly identify regressions, fixes, and new tests.",
    iconColor: "oklch(0.65 0.18 290)",
    bgColor: "oklch(0.65 0.18 290 / 0.15)",
  },
  {
    icon: Clock,
    title: "Smart Error Clustering",
    description: "Don't debug 50 tests one by one. Automatically group failures by error pattern to identify the root cause instantly.",
    iconColor: "var(--exolar-cyan)",
    bgColor: "oklch(0.75 0.15 195 / 0.15)",
  },
  {
    icon: LayoutDashboard,
    title: "Branch-Based Workflows",
    description: "Track stability per feature branch. Know exactly which PR broke the build before you merge.",
    iconColor: "oklch(0.75 0.18 145)",
    bgColor: "oklch(0.75 0.18 145 / 0.15)",
  },
]

function FeatureCard({ feature }: { feature: typeof topFeatures[0] }) {
  return (
    <div className="glass-panel p-6 space-y-4 transition-all duration-300 hover:scale-105 cursor-default">
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center"
        style={{ background: feature.bgColor }}
      >
        <feature.icon
          className="w-6 h-6"
          style={{ color: feature.iconColor }}
        />
      </div>

      {/* Content */}
      <h3
        className="text-lg font-semibold"
        style={{ color: "oklch(0.95 0 0)" }}
      >
        {feature.title}
      </h3>
      <p
        className="text-sm"
        style={{ color: "oklch(0.6 0 0)" }}
      >
        {feature.description}
      </p>
    </div>
  )
}

export function FeaturesGrid() {
  return (
    <section className="py-24" style={{ background: "var(--deep-void-light)" }}>
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <h2
            className="text-3xl md:text-4xl font-bold"
            style={{ color: "oklch(0.95 0 0)" }}
          >
            Core Dashboard Features
          </h2>
          <p style={{ color: "oklch(0.6 0 0)" }}>
            Everything you need to monitor and debug your E2E test suite.
          </p>
        </div>

        {/* Row 1: Top 3 features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-6">
          {topFeatures.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>

        {/* Row 2: Bottom 3 features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {bottomFeatures.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
