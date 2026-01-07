import type {
  ExecutionRequest,
  TestResultRequest,
  ClassificationOptions,
} from "./types"

// Import from new modular files
import {
  createApiKey,
  getApiKeysByOrg,
  getApiKeyByHash,
  revokeApiKey,
  updateApiKeyLastUsed,
} from "./db/api-keys"
import {
  searchTests,
  getTestHistory,
  getTestStatistics,
  getFailuresWithAIContext,
  getErrorTypeDistribution,
} from "./db/search"
import {
  getDashboardMetrics,
  getTrendData,
  getFailureTrendData,
  getBranches,
  getSuites,
  getSlowestTests,
  getSuitePassRates,
  getReliabilityScore,
} from "./db/metrics"
import {
  updatePerformanceBaselines,
  getPerformanceRegressions,
  getTestDurationHistory,
} from "./db/performance"
import {
  getExecutions,
  searchExecutions,
  getExecutionById,
  getExecutionsGroupedByBranch,
} from "./db/executions"
import {
  getTestResultsByExecutionId,
  getFailedTestsByExecutionId,
  getExecutionSummary,
  getErrorDistributionByExecution,
} from "./db/results"
import {
  getFlakiestTests,
  getFlakinessSummary,
  getTestFlakiness,
} from "./db/flakiness"
import {
  getLatestExecutionByBranch,
  compareExecutions,
} from "./db/comparison"
import {
  getFailureClassification,
} from "./db/classification"
import {
  insertExecution,
  insertTestResults,
} from "./db/ingestion"
import type {
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
} from "./db/types"

// Re-export for backwards compatibility
export { getSql, setServiceAccountContext } from "./db/connection"
export { generateTestSignature, isTestFlaky } from "./db/utils"
export type {
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
} from "./db/types"

// Re-export domain modules
export {
  createApiKey,
  getApiKeysByOrg,
  getApiKeyByHash,
  revokeApiKey,
  updateApiKeyLastUsed,
} from "./db/api-keys"
export {
  searchTests,
  getTestHistory,
  getTestStatistics,
  getFailuresWithAIContext,
  getErrorTypeDistribution,
} from "./db/search"
export {
  getDashboardMetrics,
  getTrendData,
  getFailureTrendData,
  getBranches,
  getSuites,
  getSlowestTests,
  getSuitePassRates,
  getReliabilityScore,
} from "./db/metrics"
export {
  updatePerformanceBaselines,
  getPerformanceRegressions,
  getTestDurationHistory,
} from "./db/performance"
export {
  getExecutions,
  searchExecutions,
  getExecutionById,
  getExecutionsGroupedByBranch,
} from "./db/executions"
export {
  getTestResultsByExecutionId,
  getFailedTestsByExecutionId,
  getExecutionSummary,
  getErrorDistributionByExecution,
} from "./db/results"
export {
  getFlakiestTests,
  getFlakinessSummary,
  updateFlakinessHistory,
  getTestFlakiness,
} from "./db/flakiness"
export {
  getLatestExecutionByBranch,
  compareExecutions,
} from "./db/comparison"
export {
  getFailureClassification,
} from "./db/classification"
export {
  insertExecution,
  insertTestResults,
  insertArtifacts,
} from "./db/ingestion"

// ============================================
// Org-Bound Query Helper
// ============================================

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
    getExecutions: (limit?: number, offset?: number, status?: string, branch?: string, dateRange?: DateRangeFilter, suite?: string) =>
      getExecutions(organizationId, limit, offset, status, branch, dateRange, suite),
    getExecutionById: (id: number) =>
      getExecutionById(organizationId, id),
    getTestResultsByExecutionId: (executionId: number) =>
      getTestResultsByExecutionId(organizationId, executionId),
    getExecutionsGroupedByBranch: (dateRange?: DateRangeFilter, maxRunsPerSuite?: number) =>
      getExecutionsGroupedByBranch(organizationId, dateRange, maxRunsPerSuite),

    // Metrics queries
    getDashboardMetrics: (dateRange?: DateRangeFilter) =>
      getDashboardMetrics(organizationId, dateRange),
    getTrendData: (options?: TrendOptions) =>
      getTrendData(organizationId, options || {}),
    getFailureTrendData: (days?: number, dateRange?: DateRangeFilter) =>
      getFailureTrendData(organizationId, days, dateRange),
    getReliabilityScore: (options?: ReliabilityScoreOptions | DateRangeFilter) =>
      getReliabilityScore(organizationId, options),

    // Helper queries
    getBranches: () =>
      getBranches(organizationId),
    getSuites: () =>
      getSuites(organizationId),

    // Search and history queries
    searchTests: (query: string, limit?: number, offset?: number) =>
      searchTests(organizationId, query, limit, offset),
    searchExecutions: (query: string, limit?: number, branch?: string, suite?: string) =>
      searchExecutions(organizationId, query, limit, branch, suite),
    getTestHistory: (signature: string, limit?: number, offset?: number) =>
      getTestHistory(organizationId, signature, limit, offset),
    getTestStatistics: (signature: string) =>
      getTestStatistics(organizationId, signature),

    // AI context queries
    getFailuresWithAIContext: (options?: { errorType?: string; testFile?: string; limit?: number; offset?: number; since?: string }) =>
      getFailuresWithAIContext(organizationId, options),
    getErrorTypeDistribution: (options?: ErrorDistributionOptions | string) =>
      getErrorTypeDistribution(organizationId, options),

    // Flakiness queries
    getFlakiestTests: (options?: GetFlakiestTestsOptions | number) =>
      getFlakiestTests(organizationId, options),
    getFlakinessSummary: () =>
      getFlakinessSummary(organizationId),
    getTestFlakiness: (signature: string) =>
      getTestFlakiness(organizationId, signature),

    // Dashboard analytics queries
    getSlowestTests: (limit?: number, minRuns?: number) =>
      getSlowestTests(organizationId, limit, minRuns),
    getSuitePassRates: () =>
      getSuitePassRates(organizationId),

    // Insert functions
    insertExecution: (data: ExecutionRequest) =>
      insertExecution(organizationId, data),
    insertTestResults: (executionId: number, results: TestResultRequest[]) =>
      insertTestResults(organizationId, executionId, results),

    // API key functions
    createApiKey: (name: string, keyHash: string, keyPrefix: string, createdBy: number | null) =>
      createApiKey(organizationId, name, keyHash, keyPrefix, createdBy),
    getApiKeys: () =>
      getApiKeysByOrg(organizationId),
    revokeApiKey: (keyId: number) =>
      revokeApiKey(keyId, organizationId),

    // Performance regression functions
    updatePerformanceBaselines: () =>
      updatePerformanceBaselines(organizationId),
    getPerformanceRegressions: (options?: PerformanceRegressionsOptions | number, hours?: number) =>
      getPerformanceRegressions(organizationId, options, hours),
    getTestDurationHistory: (testSignature: string, days?: number) =>
      getTestDurationHistory(organizationId, testSignature, days),

    // Comparison functions
    compareExecutions: (baselineExecutionId: number, currentExecutionId: number, options?: { performanceThreshold?: number }) =>
      compareExecutions(organizationId, baselineExecutionId, currentExecutionId, options),
    getLatestExecutionByBranch: (branch: string, suite?: string) =>
      getLatestExecutionByBranch(organizationId, branch, suite),

    // Failure classification (auto-triage)
    getFailureClassification: (options: ClassificationOptions) =>
      getFailureClassification(organizationId, options),
  }
}
