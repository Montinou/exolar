/**
 * Changelog Data Structure
 * Central source of truth for all product updates and feature releases
 */

export interface ChangelogFeature {
  title: string
  description: string
  icon: string
  docsUrl?: string
}

export interface ChangelogMigration {
  title: string
  steps: string[]
  docsUrl: string
}

export interface ChangelogEntry {
  id: string
  date: string // ISO date
  version: string
  title: string
  description: string
  type: "feature" | "improvement" | "fix" | "breaking"
  features: ChangelogFeature[]
  migration?: ChangelogMigration
}

/**
 * All changelog entries in reverse chronological order (newest first)
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "mcp-v2-launch",
    date: "2026-01-10",
    version: "v2.0",
    title: "MCP Integration v2.0 - Router Pattern & Semantic Layer",
    description:
      "Major update to MCP integration introducing a consolidated 5-tool router pattern, semantic definitions for AI safety, and HTTP Streamable transport. This update reduces token overhead by 83% and makes Claude Code integration more reliable.",
    type: "feature",
    features: [
      {
        icon: "🎯",
        title: "5-Tool Router Pattern",
        description:
          "Consolidated from 24 individual tools to 5 consolidated tools (explore, query, action, definition, installation). This architectural change reduces token overhead from ~3,000 to ~500 tokens - an 83% reduction.",
        docsUrl: "/docs/mcp#architecture",
      },
      {
        icon: "📊",
        title: "14 Queryable Datasets",
        description:
          "Universal data access through the query_exolar_data tool. Datasets include: executions, failures, flaky tests, trends, dashboard stats, error analysis, test search, test history, flakiness summary, reliability score, performance regressions, and more.",
        docsUrl: "/docs/mcp#datasets",
      },
      {
        icon: "🧠",
        title: "Semantic Definitions Layer",
        description:
          "New get_semantic_definition tool provides explicit metric definitions with formulas, thresholds, and units. This prevents AI hallucinations by giving Claude precise information about what each metric means and how it's calculated.",
        docsUrl: "/docs/mcp#semantic-definitions",
      },
      {
        icon: "⚡",
        title: "HTTP Streamable Transport",
        description:
          "Upgraded to the new MCP standard transport protocol (HTTP Streamable). Replaces legacy SSE with automatic retry logic, better payload chunking, and improved reliability. Uses Vercel's mcp-handler v1.0.7.",
        docsUrl: "/docs/mcp#installation",
      },
      {
        icon: "🔒",
        title: "Dual Authentication",
        description:
          "Enhanced security with dual-token validation: Neon Auth tokens (RS256 with JWKS verification) for browser sessions and MCP tokens (HS256) for API access. Organization-scoped queries with RLS protection at the database level.",
        docsUrl: "/docs/mcp#security",
      },
      {
        icon: "📦",
        title: "Simplified Integration",
        description:
          "One-click MCP token generation at /settings/mcp. No complex setup required - just paste the configuration URL into Claude Code and start querying your test data immediately.",
        docsUrl: "/docs/mcp#installation",
      },
    ],
    migration: {
      title: "Migration from v1.x",
      steps: [
        "BREAKING: Old tool names (get_executions, get_flaky_tests, etc.) no longer work. Use the migration table in the documentation to update your prompts to the new 5-tool pattern.",
        "If using custom MCP clients: Update transport to HTTP Streamable (endpoint: /api/mcp/mcp)",
        "Regenerate your MCP token at /settings/mcp for the latest security improvements",
        "Review the semantic definitions to understand exact metric calculations",
      ],
      docsUrl: "/docs/mcp#migration",
    },
  },
  // Future entries will be added here...
  // Example structure for next entry:
  // {
  //   id: "reliability-score-v1",
  //   date: "2025-12-15",
  //   version: "v1.5",
  //   title: "Reliability Score Dashboard",
  //   description: "New dashboard page showing test suite health as a single 0-100 score...",
  //   type: "feature",
  //   features: [...],
  // },
]

/**
 * Get a specific changelog entry by ID
 */
export function getChangelogEntry(id: string): ChangelogEntry | undefined {
  return CHANGELOG_ENTRIES.find(entry => entry.id === id)
}

/**
 * Get changelog entries by type
 */
export function getChangelogEntriesByType(type: ChangelogEntry["type"]): ChangelogEntry[] {
  return CHANGELOG_ENTRIES.filter(entry => entry.type === type)
}

/**
 * Get the latest N changelog entries
 */
export function getLatestChangelog(count: number = 5): ChangelogEntry[] {
  return CHANGELOG_ENTRIES.slice(0, count)
}
