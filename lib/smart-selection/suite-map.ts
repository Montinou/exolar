// lib/smart-selection/suite-map.ts
//
// Maps catalog suite slugs (as emitted by the Eve smart-selection agent in
// `smart_selection_decisions.output.{selected_suites,skipped_suites}`) to the
// suite names actually recorded in Exolar's `test_executions.suite` column.
//
// Why this exists: the decision rows and the test-outcome rows are written by
// two different systems that never agreed on a shared suite identifier. The
// catalog (attorney_share_mvp_web/automation/playwright/smart-selection)
// uses kebab-case slugs; Exolar's CI ingestion uses human-readable suite
// names. This mapping is the only place that bridges them, so ANY new
// catalog suite must be added here (or explicitly marked unmappable) before
// its accuracy metrics can be computed.
//
// Verified against live Exolar suite names on 2026-07-17 (ENG-1434).

/**
 * catalog suite slug -> Exolar-recorded suite name (`test_executions.suite`)
 */
export const CATALOG_TO_EXOLAR_SUITE: Readonly<Record<string, string>> = {
  negotiation: "Negotiation",
  "case-settings": "Case Settings",
  "marketplace-v2": "Marketplace",
  signin: "Signin",
  "saved-filters": "Saved Filters",
  "waterfall-referrals": "Waterfall Referrals",
  "waterfall-negotiation": "Waterfall Negotiation",
  "my-referral-network-api": "My Referral Network API",
  "member-directory": "Member Directory",
  "notification-center": "Notification Center",
  "my-referrals": "My Referrals",
  profile: "Edit Profile",
}

/**
 * Catalog suites with no reliable Exolar-recorded counterpart. These are
 * NEVER guessed at — they're excluded from accuracy counts and surfaced as
 * "unmeasurable" so a bad guess can't silently inflate/deflate the confusion
 * matrix.
 */
export const UNMAPPABLE_CATALOG_SUITES: ReadonlySet<string> = new Set([
  "admin",
  "my-referral-network-integration",
  "my-referral-network-page-structure",
  "my-referral-network-phase2",
])

/**
 * Resolve a catalog suite slug to its Exolar-recorded suite name.
 *
 * Policy: returns `null` for both explicitly UNMAPPABLE suites and any
 * unrecognized slug (a suite the catalog added that this map hasn't caught
 * up with yet). Both cases are treated identically by callers — excluded
 * from TP/FP/TN/FN counts and reported as "unmeasurable" — because guessing
 * wrong here would silently corrupt the confusion matrix (e.g. counting a
 * skipped-but-unmappable suite as a "true negative" when it may have failed).
 */
export function mapCatalogSuiteToExolar(catalogSuite: string): string | null {
  if (UNMAPPABLE_CATALOG_SUITES.has(catalogSuite)) return null
  return CATALOG_TO_EXOLAR_SUITE[catalogSuite] ?? null
}
