"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Smartphone, Monitor, Tablet, Terminal, CheckCircle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const devices = [
  {
    id: "mobile",
    name: "Mobile App",
    description: "Monitor test runs and get push notifications for failures on the go.",
    icon: Smartphone,
    image: "/assets/mobile-mockup.png",
    width: 1112,
    height: 1564,
  },
  {
    id: "desktop",
    name: "Desktop HQ",
    description: "Full command center with deep trace analysis and AI debugging tools.",
    icon: Monitor,
    image: "/assets/desktop-mockup.png",
    width: 1788,
    height: 1528,
  },
  {
    id: "tablet",
    name: "Analytics",
    description: "Touch-optimized dashboards for tracking trends and flake rates.",
    icon: Tablet,
    image: "/assets/tablet-mockup.png",
    width: 1300,
    height: 1148,
  },
  {
    id: "cli",
    name: "CLI & API",
    description: "Direct MCP integration for your terminal and IDE agents.",
    icon: Terminal,
    image: "/assets/cli-mockup.png",
    width: 1412,
    height: 1216,
  },
]

export function DeviceShowcase() {
  const [activeDevice, setActiveDevice] = useState(devices[1]) // Default to Desktop
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleDeviceChange = (device: typeof activeDevice) => {
    if (device.id === activeDevice.id) return
    setIsTransitioning(true)
    setTimeout(() => {
      setActiveDevice(device)
      setIsTransitioning(false)
    }, 350)
  }

  return (
    <section className="py-32 overflow-hidden relative">
      {/* Background Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] lg:w-[800px] lg:h-[800px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{
          background: "radial-gradient(circle, var(--aestra-cyan), transparent 70%)"
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4 relative z-20">
          <h2
            className="text-4xl md:text-5xl font-bold"
            style={{ color: "oklch(0.98 0 0)" }}
          >
            Your Test Suite,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--safety-amber), var(--aestra-cyan))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Omnipresent
            </span>
          </h2>
          <p className="text-xl" style={{ color: "oklch(0.7 0 0)" }}>
            Access your E2E infrastructure from any device, anywhere.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Mobile Tabs Navigation */}
          <div className="lg:hidden w-full">
            <Tabs value={activeDevice.id} onValueChange={(value) => {
              const device = devices.find(d => d.id === value)
              if (device) handleDeviceChange(device)
            }}>
              <TabsList className="w-full h-auto flex-wrap gap-2 bg-white/5 p-2 rounded-xl">
                {devices.map((device) => (
                  <TabsTrigger
                    key={device.id}
                    value={device.id}
                    className={cn(
                      "flex-1 min-w-[calc(50%-4px)] flex items-center justify-center gap-2 py-3 px-4 rounded-lg",
                      "data-[state=active]:bg-[var(--aestra-cyan)] data-[state=active]:text-white",
                      "data-[state=inactive]:bg-transparent data-[state=inactive]:text-white/60"
                    )}
                  >
                    <device.icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{device.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {/* Active device description on mobile */}
            <p className="text-sm text-center mt-4" style={{ color: "oklch(0.6 0 0)" }}>
              {activeDevice.description}
            </p>
          </div>

          {/* Desktop Navigation Controls */}
          <div className="hidden lg:block lg:col-span-4 space-y-4">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => handleDeviceChange(device)}
                className={cn(
                  "w-full text-left p-6 rounded-xl transition-all duration-300 border group",
                  activeDevice.id === device.id
                    ? "glass-panel shadow-lg scale-105"
                    : "border-transparent hover:bg-white/5 opacity-60 hover:opacity-100"
                )}
                style={
                  activeDevice.id === device.id
                    ? { borderColor: "var(--aestra-cyan)" }
                    : {}
                }
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-lg transition-colors",
                       activeDevice.id === device.id ? "bg-[var(--aestra-cyan)] text-white" : "bg-white/10"
                    )}
                  >
                    <device.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: "oklch(0.95 0 0)" }}>
                      {device.name}
                    </h3>
                    <p className="text-sm mt-1" style={{ color: "oklch(0.6 0 0)" }}>
                      {device.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Image Display Area */}
          <div className="lg:col-span-8 relative h-[350px] sm:h-[450px] md:h-[500px] lg:h-[600px] flex items-center justify-center">
            <div
              className={cn(
                "relative transition-all duration-300 transform",
                isTransitioning ? "opacity-0 scale-95 translate-y-8" : "opacity-100 scale-100 translate-y-0"
              )}
            >
              <div className="relative group max-w-[85vw] sm:max-w-[400px] md:max-w-[500px] lg:max-w-none">
                {/* Image with radial mask for seamless edge blending */}
                <Image
                  src={activeDevice.image}
                  alt={activeDevice.name}
                  width={activeDevice.width}
                  height={activeDevice.height}
                  className="rounded-2xl relative z-10 w-full h-auto"
                  sizes="(max-width: 640px) 85vw, (max-width: 768px) 400px, (max-width: 1024px) 500px, 800px"
                  style={{
                    boxShadow: "0 0 80px -10px oklch(0.75 0.15 195 / 0.5)",
                    maskImage: "radial-gradient(ellipse 90% 85% at 50% 45%, black 50%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(ellipse 90% 85% at 50% 45%, black 50%, transparent 100%)"
                  }}
                />

                {/* Status Badge */}
                <div className="absolute -top-3 -right-2 sm:-top-6 sm:-right-6 z-30 animate-bounce">
                  <div className="glass-panel px-2 py-1 sm:px-4 sm:py-2 rounded-full flex items-center gap-1 sm:gap-2 shadow-xl">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--safety-amber)]" />
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--safety-amber)]">
                      <span className="hidden sm:inline">LATEST BUILD: </span>PASS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
