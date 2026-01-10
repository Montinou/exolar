/**
 * MCP Server Index - Exports for MCP functionality
 *
 * Consolidated Router Pattern: 24 tools → 5 tools
 * - explore_exolar_index: Discovery (datasets, branches, suites, metrics)
 * - query_exolar_data: Universal data retrieval
 * - perform_exolar_action: Heavy operations (compare, report, classify)
 * - get_semantic_definition: Metric definitions
 * - get_installation_config: CI/CD setup guide
 */

export { validateMCPToken, type MCPAuthContext } from "./auth"
export { allTools, handleToolCall } from "./tools"

// Individual handlers (for direct use if needed)
export {
  handleExplore,
  handleQuery,
  handleAction,
  handleDefinition,
} from "./handlers"

// Metric definitions and semantic layer
export {
  METRIC_DEFINITIONS,
  getMetricsByCategory,
  getMetricDefinition,
  formatMetricDefinitionText,
  getCategories,
  type MetricCategory,
  type MetricDefinition,
} from "./definitions"

// Output formatters for CLI-friendly responses
export {
  formatTable,
  formatTimeSeries,
  formatExecutions,
  formatFlakyTests,
  formatBranches,
  formatMetricValue,
  formatComparison,
  type OutputFormat,
} from "./formatters"
