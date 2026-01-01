"use client"

import { Clock, AlertTriangle, Layers } from "lucide-react"

const features = [
  {
    icon: Clock,
    title: "History Retention",
    description: "Keep test execution history for as long as you need. Analyze trends over weeks or months.",
    iconColor: "var(--electric-indigo)",
    bgColor: "oklch(0.55 0.23 270 / 0.15)",
  },
  {
    icon: AlertTriangle,
    title: "Flake Detection",
    description: "Automatically identify flaky tests with statistical analysis. Stop chasing false failures.",
    iconColor: "var(--safety-amber)",
    bgColor: "oklch(0.78 0.18 75 / 0.15)",
  },
  {
    icon: Layers,
    title: "Multi-Project Support",
    description: "Manage multiple test suites from a single dashboard. Perfect for monorepos and microservices.",
    iconColor: "oklch(0.6 0 0)",
    bgColor: "oklch(0.5 0 0 / 0.15)",
  },
]

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

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-panel p-6 space-y-4 transition-all duration-300 hover:scale-105 cursor-default"
            >
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
          ))}
        </div>
      </div>
    </section>
  )
}
