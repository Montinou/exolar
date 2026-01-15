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
  getUsersForOrg,
  createUser,
  updateUserRole,
  deleteUser,
  getInviteByEmail,
  getAllInvites,
  getInvitesForOrg,
  createInvite,
  markInviteAsUsedById,
  markInviteAsUsed,
  deleteInvite,
  checkUserAccess,
  isAdmin,
  isSuperadminByEmail,
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
  getApiKeysByUser,
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
  // V1 (Gemini 768-dim)
  storeEmbedding,
  storeEmbeddingsBatch,
  getTestsNeedingEmbeddings,
  getEmbedding,
  findSimilarFailures,
  // V2 (Jina 512-dim)
  storeEmbeddingV2,
  storeEmbeddingsBatchV2,
  getTestsNeedingEmbeddingsV2,
  getEmbeddingV2,
  findSimilarFailuresV2,
  // Unified
  storeEmbeddingAuto,
  getBestEmbedding,
  generateChunkHash,
  countTestsWithEmbeddings,
} from "./embeddings"

// Clustering operations (AI vector search)
export {
  clusterFailures,
  getClusterStats,
  findHistoricalClusters,
  type ClusteringOptionsV2,
} from "./clustering"

// Cluster cache operations (AI vector search)
export {
  getCachedClusters,
  invalidateClusterCache,
  isClustered,
  getClusterCacheStats,
} from "./cluster-cache"

// Semantic search operations (AI vector search)
export {
  searchFailuresSemantic,
  searchTestsKeyword,
  searchHybrid,
  getEmbeddingCoverage,
  type SemanticSearchOptions,
  type SemanticSearchResult,
  type TestSemanticSearchResult,
} from "./semantic-search"

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

// Mock API endpoints
export {
  // Table check
  checkMockTablesExist,
  // Interface CRUD
  createMockInterface,
  getMockInterfaces,
  getMockInterfaceById,
  getMockInterfaceBySlug,
  updateMockInterface,
  deleteMockInterface,
  // Route CRUD
  createMockRoute,
  getMockRoutes,
  getMockRouteById,
  updateMockRoute,
  deleteMockRoute,
  // Response rule CRUD
  createMockResponseRule,
  getMockResponseRules,
  getMockResponseRuleById,
  updateMockResponseRule,
  deleteMockResponseRule,
  incrementRuleHitCount,
  // Public matching
  getActiveRoutesForInterface,
  getActiveRulesForRoute,
  // Request logging
  logMockRequest,
  getMockRequestLogs,
  getMockRequestLogsFiltered,
  getMockLogStats,
  type MockRequestLogFilters,
  // Rate limiting
  checkRateLimit,
  cleanupRateLimitHits,
  // Webhook actions
  createMockWebhookAction,
  getMockWebhookActions,
  getActiveWebhookActions,
  getMockWebhookActionById,
  updateMockWebhookAction,
  deleteMockWebhookAction,
  // Webhook logs
  logWebhookExecution,
  getMockWebhookLogs,
  getWebhookLogsByRequestLog,
} from "./mocks"

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
  CreateMockInterfaceRequest,
  UpdateMockInterfaceRequest,
  CreateMockRouteRequest,
  UpdateMockRouteRequest,
  CreateMockResponseRuleRequest,
  UpdateMockResponseRuleRequest,
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
  getApiKeysByUser,
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
  getTestsNeedingEmbeddingsV2,
  getEmbedding,
  getEmbeddingV2,
  getBestEmbedding,
  findSimilarFailures,
  findSimilarFailuresV2,
  countTestsWithEmbeddings,
} from "./embeddings"
import {
  clusterFailures,
  getClusterStats,
  findHistoricalClusters,
} from "./clustering"
import {
  getCachedClusters,
  invalidateClusterCache,
  isClustered,
} from "./cluster-cache"
import {
  checkMockTablesExist,
  createMockInterface,
  getMockInterfaces,
  getMockInterfaceById,
  updateMockInterface,
  deleteMockInterface,
  createMockRoute,
  getMockRoutes,
  updateMockRoute,
  deleteMockRoute,
  createMockResponseRule,
  getMockResponseRules,
  updateMockResponseRule,
  deleteMockResponseRule,
  getMockRequestLogs,
} from "./mocks"

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
    getApiKeysByUser: (userId: number) => getApiKeysByUser(organizationId, userId),
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

    // Embedding operations (AI vector search) - V1 (Gemini 768-dim)
    getTestsNeedingEmbeddings: (limit?: number) =>
      getTestsNeedingEmbeddings(organizationId, limit),
    getEmbedding: (testResultId: number) => getEmbedding(testResultId),
    findSimilarFailures: (
      embedding: number[],
      options?: { executionId?: number; threshold?: number; limit?: number }
    ) => findSimilarFailures(embedding, { ...options, organizationId }),
    countTestsWithEmbeddings: () => countTestsWithEmbeddings(organizationId),

    // Embedding operations (AI vector search) - V2 (Jina 512-dim)
    getTestsNeedingEmbeddingsV2: (limit?: number) =>
      getTestsNeedingEmbeddingsV2(organizationId, limit),
    getEmbeddingV2: (testResultId: number) => getEmbeddingV2(testResultId),
    getBestEmbedding: (testResultId: number) => getBestEmbedding(testResultId),
    findSimilarFailuresV2: (
      embedding: number[],
      options?: { executionId?: number; threshold?: number; limit?: number }
    ) => findSimilarFailuresV2(embedding, { ...options, organizationId }),

    // Clustering operations (AI vector search)
    clusterFailures: (executionId: number, options?: { distanceThreshold?: number; minClusterSize?: number; maxClusters?: number }) =>
      clusterFailures(executionId, options),
    getClusterStats: (executionId: number) => getClusterStats(executionId),
    getCachedClusters: (executionId: number, options?: { distanceThreshold?: number; minClusterSize?: number; maxClusters?: number }) =>
      getCachedClusters(executionId, options),
    invalidateClusterCache: (executionId: number) => invalidateClusterCache(executionId),
    isClustered: (executionId: number) => isClustered(executionId),
    findHistoricalClusters: (embedding: number[], options?: { threshold?: number; limit?: number; daysBack?: number }) =>
      findHistoricalClusters(embedding, organizationId, options),

    // Mock API endpoints
    createMockInterface: (data: CreateMockInterfaceRequest, createdBy: number | null) =>
      createMockInterface(organizationId, data, createdBy),
    getMockInterfaces: () => getMockInterfaces(organizationId),
    getMockInterfaceById: (interfaceId: number) =>
      getMockInterfaceById(organizationId, interfaceId),
    updateMockInterface: (interfaceId: number, data: UpdateMockInterfaceRequest) =>
      updateMockInterface(organizationId, interfaceId, data),
    deleteMockInterface: (interfaceId: number) =>
      deleteMockInterface(organizationId, interfaceId),
    createMockRoute: (interfaceId: number, data: CreateMockRouteRequest) =>
      createMockRoute(interfaceId, data),
    getMockRoutes: (interfaceId: number) => getMockRoutes(interfaceId),
    updateMockRoute: (routeId: number, data: UpdateMockRouteRequest) =>
      updateMockRoute(routeId, data),
    deleteMockRoute: (routeId: number) => deleteMockRoute(routeId),
    createMockResponseRule: (routeId: number, data: CreateMockResponseRuleRequest) =>
      createMockResponseRule(routeId, data),
    getMockResponseRules: (routeId: number) => getMockResponseRules(routeId),
    updateMockResponseRule: (ruleId: number, data: UpdateMockResponseRuleRequest) =>
      updateMockResponseRule(ruleId, data),
    deleteMockResponseRule: (ruleId: number) => deleteMockResponseRule(ruleId),
    getMockRequestLogs: (interfaceId: number, limit?: number) =>
      getMockRequestLogs(interfaceId, limit),
    getMockRequestLogsFiltered: (interfaceId: number, filters?: MockRequestLogFilters) =>
      getMockRequestLogsFiltered(interfaceId, filters),
    getMockLogStats: (interfaceId: number) => getMockLogStats(interfaceId),
  }
}
