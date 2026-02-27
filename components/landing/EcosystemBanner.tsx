const ecosystemProducts = [
  {
    name: "Voice Agents",
    description: "AI receptionists — 24/7 calls in English & Spanish",
    url: "https://voice.triqual.dev",
  },
  {
    name: "Interview Companion",
    description: "Real-time AI analysis for technical interviews",
    url: "https://interview-companion.triqual.dev",
  },
  {
    name: "Studio",
    description: "AI landing pages & editorial photography for local biz",
    url: "https://studio.triqual.dev",
  },
  {
    name: "Quoth",
    description: "Shared knowledge base for multi-agent teams",
    url: "https://quoth.triqual.dev",
  },
]

export function EcosystemBanner() {
  return (
    <section className="relative py-16 px-4 sm:px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-white/30 mb-3">Part of the Triqual Ecosystem</p>
          <h3 className="text-2xl font-bold text-white/80">
            Exolar is one of six.{" "}
            <a
              href="https://triqual.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--safety-amber)] hover:underline"
            >
              See the full platform →
            </a>
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ecosystemProducts.map((product) => (
            <a
              key={product.name}
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 p-4 transition-all duration-300 block"
            >
              <h4 className="text-sm font-semibold text-white/70 group-hover:text-white/90 transition-colors mb-1">
                {product.name}
              </h4>
              <p className="text-xs text-white/30 leading-relaxed">
                {product.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
