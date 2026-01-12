import { Sparkles, Target, Search, Zap, GitBranch, BarChart2, Settings, Check } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export const metadata = {
  title: "AI Vector Search - Exolar QA",
  description: "Smart failure clustering and semantic search powered by AI",
}

export default function AiSearchDocsPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-xs sm:text-sm font-medium mb-2">
          New in v2.3 • Jina v3 + Cohere Reranking
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
          <span className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-cyan-400" />
            AI Vector Search
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl">
          Transform test failure triage from hours to minutes. Smart clustering groups 50+ failures into root causes, 
          and semantic search finds failures by intent — not just keywords.
        </p>
      </div>

      {/* Features Grid */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="glass-card glass-card-glow p-6 space-y-3">
            <feature.icon className="h-8 w-8 text-cyan-400" />
            <h3 className="font-semibold text-lg">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>

      {/* How It Works */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">How It Works</h2>
        <div className="glass-card glass-card-glow p-6 space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Step 1</Badge>
              <h4 className="font-medium">Embedding Generation</h4>
              <p className="text-sm text-muted-foreground">
                When tests fail, error messages and stack traces are converted to 512-dimensional vectors using Jina v3 embeddings.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Step 2</Badge>
              <h4 className="font-medium">Vector Similarity Search</h4>
              <p className="text-sm text-muted-foreground">
                pgvector performs fast similarity search across your failure history using cosine distance.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Step 3</Badge>
              <h4 className="font-medium">Cohere Reranking</h4>
              <p className="text-sm text-muted-foreground">
                Results are precision-reranked using Cohere's rerank-english-v3.0 model for the most relevant matches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Using the Features */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Using AI Vector Search</h2>
        
        <div className="space-y-6">
          {/* Semantic Search */}
          <div className="glass-card glass-card-glow p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-cyan-400" />
              <h3 className="font-semibold text-lg">Semantic Search</h3>
            </div>
            <p className="text-muted-foreground">
              Find failures by describing what you&apos;re looking for in natural language.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Access via:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Dashboard search bar</strong> — Select &quot;AI&quot; or &quot;Hybrid&quot; mode from the dropdown</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Dedicated search page</strong> — <Link href="/dashboard/search" className="text-cyan-400 hover:underline">/dashboard/search</Link> for full-page search with export</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>MCP dataset</strong> — <code className="text-xs bg-muted px-1 py-0.5 rounded">semantic_search</code> via Claude Code</span>
                </li>
              </ul>
            </div>
            <div className="bg-muted/50 rounded p-3 text-sm">
              <span className="text-muted-foreground">Example queries:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {["timeout errors", "login failures", "API rate limiting", "network connection issues"].map((q) => (
                  <Badge key={q} variant="secondary">{q}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Failure Clustering */}
          <div className="glass-card glass-card-glow p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-400" />
              <h3 className="font-semibold text-lg">Failure Clustering</h3>
            </div>
            <p className="text-muted-foreground">
              Automatically group 50+ failures into root cause clusters. See &quot;50 failures → 3 issues&quot; at a glance.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Access via:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Execution details</strong> — Toggle &quot;Clustered&quot; view in the failures section</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Executions table</strong> — Hover over the AI badge next to failed count</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>MCP dataset</strong> — <code className="text-xs bg-muted px-1 py-0.5 rounded">clustered_failures</code> via Claude Code</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Similar Failures */}
          <div className="glass-card glass-card-glow p-6 space-y-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-cyan-400" />
              <h3 className="font-semibold text-lg">Similar Failures</h3>
            </div>
            <p className="text-muted-foreground">
              Find related failures across your history to identify recurring issues.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Access via:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Test History modal</strong> — Click &quot;Similar Issues&quot; tab</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Failure cards</strong> — Click &quot;Find Similar&quot; button</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>MCP action</strong> — <code className="text-xs bg-muted px-1 py-0.5 rounded">find_similar</code> via Claude Code</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* AI Insights Dashboard */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">AI Insights</h2>
        <div className="glass-card glass-card-glow p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-lg">Dashboard Card</h3>
          </div>
          <p className="text-muted-foreground">
            The AI Insights card on your main dashboard shows:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span><strong>Embedding Coverage</strong> — Percentage of failures with AI embeddings</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span><strong>Indexed Failures</strong> — Total count of searchable failures</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span><strong>Cluster Reduction</strong> — How effectively clustering reduces noise</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Admin: Backfill */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Admin: Managing Embeddings</h2>
        <div className="glass-card glass-card-glow p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-lg">Backfill Embeddings</h3>
          </div>
          <p className="text-muted-foreground">
            For existing failures without embeddings, admins can trigger a backfill:
          </p>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Go to <Link href="/settings" className="text-cyan-400 hover:underline">Settings</Link></li>
            <li>Find the &quot;AI Embeddings&quot; card</li>
            <li>Click &quot;Generate Missing Embeddings&quot;</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            New failures are automatically embedded on ingest.
          </p>
        </div>
      </section>
    </div>
  )
}

const features = [
  {
    icon: Target,
    title: "Smart Clustering",
    description: "Group 50+ failures into 3-5 root causes automatically. No more scrolling through repetitive errors.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description: "Find failures by describing what you're looking for: 'timeout errors', 'login failures', 'API issues'.",
  },
  {
    icon: GitBranch,
    title: "Similar Failures",
    description: "Identify recurring issues by finding related failures across your test history.",
  },
  {
    icon: Zap,
    title: "Jina v3 Embeddings",
    description: "512-dim Matryoshka embeddings with asymmetric query/passage support for precision.",
  },
  {
    icon: BarChart2,
    title: "AI Insights Card",
    description: "Dashboard widget showing embedding coverage and cluster reduction metrics.",
  },
  {
    icon: Settings,
    title: "Admin Controls",
    description: "Backfill embeddings for existing failures and monitor indexing progress.",
  },
]
