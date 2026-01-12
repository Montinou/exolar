// lib/db/index.ts
// Database module - exports all query functions
// Import from @/lib/db for all database operations

// Connection utilities
export { getSql, setServiceAccountContext } from "./connection"

// Shared utilities
export { generateTestSignature, isTestFlaky } from "./utils"

// Types
export type {
  // User types
  DashboardUser,
  Invite,
  // Organization types
  Organization,
  OrganizationMember,
  OrganizationWithRole,
  // Query types
  DateRangeFilter,
  FailedTestResult,
  ExecutionSummary,
  TrendPeriod,
  TrendOptions,
  TrendDataPoint,
  BranchStatistics,
  SuiteStatistics,
  GetFlakiestTestsOptions,
  GetFlakinessSummaryOptions,
  SlowestTest,
  SuitePassRate,
  OrgApiKey,
  OrgApiKeyWithHash,
  ReliabilityScoreOptions,
  PerformanceRegressionsOptions,
  ErrorDistributionOptions,
  ErrorDistributionItem,
} from "./types"

// User operations
export {
  getUserByEmail,
  getAllUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getInviteByEmail,
  getAllInvites,
  createInvite,
  markInviteAsUsedById,
  markInviteAsUsed,
  deleteInvite,
  checkUserAccess,
  isAdmin,
} from "./users"

// Organization operations
export {
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization,
  getAllOrganizations,
  getOrganizationMembers,
  addOrganizationMember,
  updateMemberRole,
  removeMember,
  getUserOrganizations,
  isUserMemberOfOrg,
  createOrgInvite,
  getOrgInvites,
} from "./orgs"

// Execution queries
export {
  getExecutions,
  searchExecutions,
  getExecutionById,
  getExecutionsGroupedByBranch,
} from "./executions"

// Test results queries
export {
  getTestResultsByExecutionId,
  getFailedTestsByExecutionId,
  getExecutionSummary,
  getErrorDistributionByExecution,
} from "./results"

// Dashboard metrics
export {
  getDashboardMetrics,
  getLatestExecutionId,
  getTrendData,
  getFailureTrendData,
  getBranches,
  getSuites,
  getSlowestTests,
  getSuitePassRates,
  getReliabilityScore,
} from "./metrics"
export type { DashboardMetricsOptions } from "./metrics"

// Search and history
export {
  searchTests,
  getTestHistory,
  getTestStatistics,
  getFailuresWithAIContext,
  getErrorTypeDistribution,
} from "./search"

// Flakiness detection
export {
  getFlakiestTests,
  getFlakinessSummary,
  updateFlakinessHistory,
  getTestFlakiness,
} from "./flakiness"

// Performance regression
export {
  updatePerformanceBaselines,
  getPerformanceRegressions,
  getTestDurationHistory,
} from "./performance"

// Execution comparison
export {
  getLatestExecutionByBranch,
  compareExecutions,
} from "./comparison"

// Failure classification
export { getFailureClassification } from "./classification"

// API key management
export {
  createApiKey,
  getApiKeysByOrg,
  getApiKeyByHash,
  revokeApiKey,
  updateApiKeyLastUsed,
} from "./api-keys"

// Data ingestion
export {
  insertExecution,
  insertTestResults,
  insertArtifacts,
} from "./ingestion"

// Wishlist operations
export {
  addToWishlist,
  isEmailInWishlist,
  getWishlistEntries,
  getWishlistCount,
} from "./wishlist"

// Embedding operations (AI vector search)
export {
  storeEmbedding,
  storeEmbeddingsBatch,
  getTestsNeedingEmbeddings,
  getEmbedding,
  findSimilarFailures,
  countTestsWithEmbeddings,
} from "./embeddings"

// Suite and test tracking (Phase 14)
export {
  detectTechStack,
  getSuiteRegistry,
  getSuiteByName,
  getSuiteById,
  upsertSuite,
  updateSuite,
  getSuitesWithStats,
  getSuiteTests,
  upsertSuiteTest,
  markInactiveTests,
  updateSuiteTestCounts,
  getInactiveTests,
  getSuiteTestBySignature,
  getSuiteTestsWithSuiteName,
  getSuiteCountsSummary,
} from "./suites"

// ============================================
// Org-Bound Query Helper
// ============================================

// Re-export types needed for parameters
import type {
  TestResultRequest,
  ExecutionRequest,
  ClassificationOptions,
  TechStack,
  GetSuitesOptions,
  GetSuiteTestsOptions,
  UpdateSuiteRequest,
} from "../types"
import type {
  DateRangeFilter,
  TrendOptions,
  GetFlakiestTestsOptions,
  ReliabilityScoreOptions,
  PerformanceRegressionsOptions,
  ErrorDistributionOptions,
} from "./types"

// Import functions for binding
import {
  getExecutions,
  searchExecutions,
  getExecutionById,
  getExecutionsGroupedByBranch,
} from "./executions"
import { getTestResultsByExecutionId } from "./results"
import {
  getDashboardMetrics,
  getLatestExecutionId,
  getTrendData,
  getFailureTrendData,
  getBranches,
  getSuites,
  getSlowestTests,
  getSuitePassRates,
  getReliabilityScore,
} from "./metrics"
import type { DashboardMetricsOptions } from "./metrics"
import {
  searchTests,
  getTestHistory,
  getTestStatistics,
  getFailuresWithAIContext,
  getErrorTypeDistribution,
} from "./search"
import {
  getFlakiestTests,
  getFlakinessSummary,
  getTestFlakiness,
} from "./flakiness"
import {
  updatePerformanceBaselines,
  getPerformanceRegressions,
  getTestDurationHistory,
} from "./performance"
import {
  getLatestExecutionByBranch,
  compareExecutions,
} from "./comparison"
import { getFailureClassification } from "./classification"
import {
  createApiKey,
  getApiKeysByOrg,
  revokeApiKey,
} from "./api-keys"
import {
  insertExecution,
  insertTestResults,
} from "./ingestion"
import {
  getSuiteRegistry,
  getSuiteById,
  upsertSuite,
  updateSuite,
  getSuitesWithStats,
  getSuiteTests,
  upsertSuiteTest,
  markInactiveTests,
  updateSuiteTestCounts,
  getInactiveTests,
  getSuiteCountsSummary,
} from "./suites"
import {
  getOrganizationMembers,
  getOrgInvites,
  isUserMemberOfOrg,
} from "./orgs"
import {
  getTestsNeedingEmbeddings,
  getEmbedding,
  findSimilarFailures,
  countTestsWithEmbeddings,
} from "./embeddings"

/**
 * Create org-bound query functions.
 * Use this to avoid passing organizationId to every function.
 *
 * Usage in API routes:
 *   const context = await getSessionContext()
 *   const db = getQueriesForOrg(context.organizationId)
 *   const executions = await db.getExecutions(50, "failed")
 */
export function getQueriesForOrg(organizationId: number) {
  return {
    // Execution queries
    getExecutions: (
      limit?: number,
      offset?: number,
      status?: string,
      branch?: string,
      dateRange?: DateRangeFilter,
      suite?: string
    ) => getExecutions(organizationId, limit, offset, status, branch, dateRange, suite),
    getExecutionById: (id: number) => getExecutionById(organizationId, id),
    getTestResultsByExecutionId: (executionId: number) =>
      getTestResultsByExecutionId(organizationId, executionId),
    getExecutionsGroupedByBranch: (dateRange?: DateRangeFilter, maxRunsPerSuite?: number) =>
      getExecutionsGroupedByBranch(organizationId, dateRange, maxRunsPerSuite),

    // Metrics queries
    getDashboardMetrics: (options?: DashboardMetricsOptions | DateRangeFilter) =>
      getDashboardMetrics(organizationId, options),
    getLatestExecutionId: (branch?: string, suite?: string) =>
      getLatestExecutionId(organizationId, branch, suite),
    getTrendData: (options?: TrendOptions) => getTrendData(organizationId, options || {}),
    getFailureTrendData: (days?: number, dateRange?: DateRangeFilter) =>
      getFailureTrendData(organizationId, days, dateRange),
    getReliabilityScore: (options?: ReliabilityScoreOptions | DateRangeFilter) =>
      getReliabilityScore(organizationId, options),

    // Helper queries
    getBranches: () => getBranches(organizationId),
    getSuites: () => getSuites(organizationId),

    // Search and history queries
    searchTests: (query: string, limit?: number, offset?: number) =>
      searchTests(organizationId, query, limit, offset),
    searchExecutions: (query: string, limit?: number, branch?: string, suite?: string) =>
      searchExecutions(organizationId, query, limit, branch, suite),
    getTestHistory: (signature: string, limit?: number, offset?: number) =>
      getTestHistory(organizationId, signature, limit, offset),
    getTestStatistics: (signature: string) => getTestStatistics(organizationId, signature),

    // AI context queries
    getFailuresWithAIContext: (options?: {
      errorType?: string
      testFile?: string
      limit?: number
      offset?: number
      since?: string
    }) => getFailuresWithAIContext(organizationId, options),
    getErrorTypeDistribution: (options?: ErrorDistributionOptions | string) =>
      getErrorTypeDistribution(organizationId, options),

    // Flakiness queries
    getFlakiestTests: (options?: GetFlakiestTestsOptions | number) =>
      getFlakiestTests(organizationId, options),
    getFlakinessSummary: () => getFlakinessSummary(organizationId),
    getTestFlakiness: (signature: string) => getTestFlakiness(organizationId, signature),

    // Dashboard analytics queries
    getSlowestTests: (limit?: number, minRuns?: number) =>
      getSlowestTests(organizationId, limit, minRuns),
    getSuitePassRates: () => getSuitePassRates(organizationId),

    // Insert functions (auto-registers suites and tests)
    insertExecution: (data: ExecutionRequest) => insertExecution(organizationId, data),
    insertTestResults: (executionId: number, results: TestResultRequest[], suiteId?: number | null) =>
      insertTestResults(organizationId, executionId, results, suiteId),

    // API key functions
    createApiKey: (name: string, keyHash: string, keyPrefix: string, createdBy: number | null) =>
      createApiKey(organizationId, name, keyHash, keyPrefix, createdBy),
    getApiKeys: () => getApiKeysByOrg(organizationId),
    revokeApiKey: (keyId: number) => revokeApiKey(keyId, organizationId),

    // Performance regression functions
    updatePerformanceBaselines: () => updatePerformanceBaselines(organizationId),
    getPerformanceRegressions: (
      options?: PerformanceRegressionsOptions | number,
      hours?: number
    ) => getPerformanceRegressions(organizationId, options, hours),
    getTestDurationHistory: (testSignature: string, days?: number) =>
      getTestDurationHistory(organizationId, testSignature, days),

    // Comparison functions
    compareExecutions: (
      baselineExecutionId: number,
      currentExecutionId: number,
      options?: { performanceThreshold?: number }
    ) => compareExecutions(organizationId, baselineExecutionId, currentExecutionId, options),
    getLatestExecutionByBranch: (branch: string, suite?: string) =>
      getLatestExecutionByBranch(organizationId, branch, suite),

    // Failure classification (auto-triage)
    getFailureClassification: (options: ClassificationOptions) =>
      getFailureClassification(organizationId, options),

    // Organization queries (org-bound)
    getOrganizationMembers: () => getOrganizationMembers(organizationId),
    getOrgInvites: () => getOrgInvites(organizationId),
    isUserMemberOfOrg: (userId: number) => isUserMemberOfOrg(userId, organizationId),

    // Suite and test tracking (Phase 14)
    getSuiteRegistry: (options?: GetSuitesOptions) =>
      getSuiteRegistry(organizationId, options),
    getSuiteById: (suiteId: number) => getSuiteById(organizationId, suiteId),
    upsertSuite: (name: string, techStack?: TechStack, executionId?: number) =>
      upsertSuite(organizationId, name, techStack, executionId),
    updateSuite: (suiteId: number, updates: UpdateSuiteRequest) =>
      updateSuite(organizationId, suiteId, updates),
    getSuitesWithStats: () => getSuitesWithStats(organizationId),
    getSuiteTests: (options?: GetSuiteTestsOptions) =>
      getSuiteTests(organizationId, options),
    upsertSuiteTest: (
      testSignature: string,
      testName: string,
      testFile: string,
      status: string,
      durationMs: number,
      isCritical: boolean,
      suiteId: number | null
    ) =>
      upsertSuiteTest(
        organizationId,
        testSignature,
        testName,
        testFile,
        status,
        durationMs,
        isCritical,
        suiteId
      ),
    markInactiveTests: (inactiveDays?: number) =>
      markInactiveTests(organizationId, inactiveDays),
    updateSuiteTestCounts: () => updateSuiteTestCounts(organizationId),
    getInactiveTests: (limit?: number) => getInactiveTests(organizationId, limit),
    getSuiteCountsSummary: () => getSuiteCountsSummary(organizationId),

    // Embedding operations (AI vector search)
    getTestsNeedingEmbeddings: (limit?: number) =>
      getTestsNeedingEmbeddings(organizationId, limit),
    getEmbedding: (testResultId: number) => getEmbedding(testResultId),
    findSimilarFailures: (
      embedding: number[],
      options?: { executionId?: number; threshold?: number; limit?: number }
    ) => findSimilarFailures(embedding, { ...options, organizationId }),
    countTestsWithEmbeddings: () => countTestsWithEmbeddings(organizationId),
  }
}
