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
    id: "integration-engineer-persona",
    date: "2026-01-11",
    version: "v2.1",
    title: "AI-Guided CI/CD Setup with Integration Engineer Persona",
    description:
      "Transform CI/CD setup from confusing config dumps to conversational pair programming. Claude Code now adopts an Integration Engineer persona that asks about your environment first, then provides tailored instructions for your specific CI provider and project structure.",
    type: "improvement",
    features: [
      {
        icon: "🤖",
        title: "Conversational Setup Experience",
        description:
          "Claude asks discovery questions (CI provider, monorepo structure) before providing configuration. No more guessing where to put tokens or how to merge config files.",
        docsUrl: "/docs/mcp#conversational-setup",
      },
      {
        icon: "🎯",
        title: "GitHub Actions-Specific Instructions",
        description:
          "Get GitHub Actions-specific instructions with exact secrets management steps (Settings > Secrets > Actions path). Currently focused on GitHub Actions with more CI providers coming soon.",
        docsUrl: "/docs/mcp#installation",
      },
      {
        icon: "📦",
        title: "Monorepo-Aware Guidance",
        description:
          "Claude explicitly asks if you're using a monorepo and provides guidance on where to place reporters, how to configure per-package Playwright configs, and manage environment variables.",
        docsUrl: "/docs/mcp#conversational-setup",
      },
      {
        icon: "✅",
        title: "Built-in Validation",
        description:
          "Claude suggests dry run commands to verify integration locally before pushing to CI. Catch configuration issues early with 'npx playwright test --reporter=@exolar/reporter'.",
        docsUrl: "/docs/mcp#troubleshooting",
      },
      {
        icon: "🔧",
        title: "Contextual Troubleshooting",
        description:
          "Get instant help for common issues: 401 Unauthorized (token expiration), missing data (reporter not in config), module errors (missing npm install). Claude provides exact fix steps based on your error.",
        docsUrl: "/docs/mcp#troubleshooting",
      },
      {
        icon: "🚀",
        title: "Setup Guide Dataset",
        description:
          "New 'setup_guide' dataset in query_exolar_data allows programmatic access to filtered configuration with ci_provider, framework, monorepo, and section filters.",
        docsUrl: "/docs/mcp#datasets",
      },
    ],
  },
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
