"use client"

import { Terminal, Plug, Bot } from "lucide-react"

const features = [
  {
    icon: Terminal,
    title: "Direct Agent Access",
    description:
      "Your AI coding assistant can now read test failures directly from the database. No more copy-pasting logs.",
    accentColor: "var(--electric-indigo)",
  },
  {
    icon: Plug,
    title: "Installable Skills",
    description:
      "Seamlessly install E2E skills into Claude Desktop or Cursor with a single AI prompt. Zero configuration required.",
    accentColor: "var(--safety-amber)",
  },
  {
    icon: Bot,
    title: "Auto-Triage",
    description:
      "Agents can classify failures (Flake vs. Bug) automatically, saving hours of manual investigation every week.",
    accentColor: "var(--electric-indigo)",
  },
]

export function MCPShowcase() {
  return (
    <section className="relative py-32 dot-pattern">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 100%, oklch(0.78 0.18 75 / 0.08), transparent)`,
        }}
      />

      <div className="relative z-10 container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2
            className="text-4xl md:text-5xl font-bold"
            style={{ color: "oklch(0.98 0 0)" }}
          >
            The{" "}
            <span style={{ color: "var(--safety-amber)" }}>MCP</span>{" "}
            Revolution
          </h2>
          <p
            className="text-lg"
            style={{ color: "oklch(0.6 0 0)" }}
          >
            Model Context Protocol transforms how AI agents interact with your test infrastructure.
            Direct access. Zero friction.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="holographic-border group"
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <div
                className="p-8 h-full space-y-6 transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ background: "var(--deep-void)" }}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${feature.accentColor}20`,
                    boxShadow: `0 0 30px ${feature.accentColor}30`,
                  }}
                >
                  <feature.icon
                    className="w-7 h-7"
                    style={{ color: feature.accentColor }}
                  />
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <h3
                    className="text-xl font-semibold"
                    style={{ color: "oklch(0.95 0 0)" }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "oklch(0.6 0 0)" }}
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
