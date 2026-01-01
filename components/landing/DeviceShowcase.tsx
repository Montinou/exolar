"use client"

import Image from "next/image"

export function DeviceShowcase() {
  return (
    <section className="py-24 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <h2
            className="text-3xl md:text-4xl font-bold"
            style={{ color: "oklch(0.95 0 0)" }}
          >
            Monitor From{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--safety-amber), var(--electric-indigo))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Anywhere
            </span>
          </h2>
          <p style={{ color: "oklch(0.6 0 0)" }}>
            Stay connected to your E2E suite. Whether you're at your desk or on the go.
          </p>
        </div>

        {/* Device Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Mobile Mockup */}
          <div className="relative group perspective-1000">
            <div
              className="absolute inset-0 blur-3xl opacity-20 transition-opacity duration-1000 group-hover:opacity-40"
              style={{ background: "var(--electric-indigo)" }}
            />
            <div className="relative transform transition-transform duration-700 hover:scale-[1.02] hover:rotate-y-6">
              <Image
                src="/assets/mobile-mockup.png"
                alt="Mobile Dashboard App"
                width={600}
                height={800}
                className="rounded-[2rem] shadow-2xl mx-auto"
                style={{
                  boxShadow: "0 20px 50px -10px oklch(0 0 0 / 0.5)",
                }}
              />
            </div>
          </div>

          {/* Desktop Mockup */}
          <div className="relative group perspective-1000">
             <div
              className="absolute inset-0 blur-3xl opacity-20 transition-opacity duration-1000 group-hover:opacity-40"
              style={{ background: "var(--safety-amber)" }}
            />
            <div className="relative transform transition-transform duration-700 hover:scale-[1.02] hover:-rotate-y-3">
              <Image
                src="/assets/desktop-mockup.png"
                alt="Desktop Dashboard View"
                width={800}
                height={600}
                className="rounded-xl shadow-2xl"
                style={{
                  boxShadow: "0 20px 50px -10px oklch(0 0 0 / 0.5)",
                }}
              />
            </div>
             <div className="mt-8 space-y-4 text-center lg:text-left">
              <h3 className="text-xl font-semibold" style={{ color: "oklch(0.9 0 0)" }}>Command Center Ready</h3>
              <p style={{ color: "oklch(0.6 0 0)" }}>
                Full detailed traces, AI analysis logs, and historical trends at your fingertips.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
