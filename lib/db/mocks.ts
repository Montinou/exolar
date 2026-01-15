import { getSql } from "./connection"
import type {
  MockInterface,
  MockInterfaceWithStats,
  MockRoute,
  MockRouteWithRuleCount,
  MockResponseRule,
  MockRequestLog,
  CreateMockInterfaceRequest,
  UpdateMockInterfaceRequest,
  CreateMockRouteRequest,
  UpdateMockRouteRequest,
  CreateMockResponseRuleRequest,
  UpdateMockResponseRuleRequest,
} from "@/lib/types"

// ============================================
// Table Existence Check
// ============================================

/**
 * Check if mock tables exist in the database.
 * Useful for providing helpful error messages when migrations haven't been run.
 */
export async function checkMockTablesExist(): Promise<boolean> {
  const sql = getSql()
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'mock_interfaces'
      ) as exists
    `
    return result[0]?.exists === true
  } catch (error) {
    console.error("[checkMockTablesExist] Error checking tables:", error)
    return false
  }
}

// ============================================
// Mock Interface CRUD
// ============================================

/**
 * Create a new mock interface
 */
export async function createMockInterface(
  organizationId: number,
  data: CreateMockInterfaceRequest,
  createdBy: number | null
): Promise<MockInterface> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO mock_interfaces (
      organization_id,
      name,
      slug,
      description,
      rate_limit_rpm,
      created_by
    ) VALUES (
      ${organizationId},
      ${data.name},
      ${data.slug},
      ${data.description ?? null},
      ${data.rate_limit_rpm ?? 100},
      ${createdBy}
    )
    RETURNING *
  `

  return result[0] as MockInterface
}

/**
 * Get all mock interfaces for an organization with stats
 */
export async function getMockInterfaces(
  organizationId: number
): Promise<MockInterfaceWithStats[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      mi.*,
      COALESCE(route_stats.total_routes, 0)::int as total_routes,
      COALESCE(route_stats.total_rules, 0)::int as total_rules,
      COALESCE(log_stats.total_requests, 0)::int as total_requests,
      COALESCE(log_stats.requests_last_24h, 0)::int as requests_last_24h,
      log_stats.last_request_at
    FROM mock_interfaces mi
    LEFT JOIN (
      SELECT
        mr.interface_id,
        COUNT(DISTINCT mr.id) as total_routes,
        COUNT(mrr.id) as total_rules
      FROM mock_routes mr
      LEFT JOIN mock_response_rules mrr ON mrr.route_id = mr.id
      GROUP BY mr.interface_id
    ) route_stats ON route_stats.interface_id = mi.id
    LEFT JOIN (
      SELECT
        interface_id,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE request_at > NOW() - INTERVAL '24 hours') as requests_last_24h,
        MAX(request_at) as last_request_at
      FROM mock_request_logs
      GROUP BY interface_id
    ) log_stats ON log_stats.interface_id = mi.id
    WHERE mi.organization_id = ${organizationId}
    ORDER BY mi.created_at DESC
  `

  return result as MockInterfaceWithStats[]
}

/**
 * Get a mock interface by ID
 */
export async function getMockInterfaceById(
  organizationId: number,
  interfaceId: number
): Promise<MockInterface | null> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_interfaces
    WHERE id = ${interfaceId}
      AND organization_id = ${organizationId}
  `

  return result.length > 0 ? (result[0] as MockInterface) : null
}

/**
 * Get a mock interface by org slug and interface slug (for public lookup)
 */
export async function getMockInterfaceBySlug(
  orgSlug: string,
  interfaceSlug: string
): Promise<MockInterface | null> {
  const sql = getSql()

  const result = await sql`
    SELECT mi.*
    FROM mock_interfaces mi
    JOIN organizations o ON o.id = mi.organization_id
    WHERE o.slug = ${orgSlug}
      AND mi.slug = ${interfaceSlug}
      AND mi.is_active = true
  `

  return result.length > 0 ? (result[0] as MockInterface) : null
}

/**
 * Update a mock interface
 */
export async function updateMockInterface(
  organizationId: number,
  interfaceId: number,
  data: UpdateMockInterfaceRequest
): Promise<MockInterface | null> {
  const sql = getSql()

  // Build dynamic update
  const updates: string[] = ["updated_at = NOW()"]
  const values: unknown[] = []

  if (data.name !== undefined) {
    values.push(data.name)
    updates.push(`name = $${values.length}`)
  }
  if (data.slug !== undefined) {
    values.push(data.slug)
    updates.push(`slug = $${values.length}`)
  }
  if (data.description !== undefined) {
    values.push(data.description)
    updates.push(`description = $${values.length}`)
  }
  if (data.is_active !== undefined) {
    values.push(data.is_active)
    updates.push(`is_active = $${values.length}`)
  }
  if (data.rate_limit_rpm !== undefined) {
    values.push(data.rate_limit_rpm)
    updates.push(`rate_limit_rpm = $${values.length}`)
  }

  const result = await sql`
    UPDATE mock_interfaces
    SET
      name = COALESCE(${data.name ?? null}, name),
      slug = COALESCE(${data.slug ?? null}, slug),
      description = COALESCE(${data.description}, description),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      rate_limit_rpm = COALESCE(${data.rate_limit_rpm ?? null}, rate_limit_rpm),
      updated_at = NOW()
    WHERE id = ${interfaceId}
      AND organization_id = ${organizationId}
    RETURNING *
  `

  return result.length > 0 ? (result[0] as MockInterface) : null
}

/**
 * Delete a mock interface (cascades to routes, rules, logs)
 */
export async function deleteMockInterface(
  organizationId: number,
  interfaceId: number
): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    DELETE FROM mock_interfaces
    WHERE id = ${interfaceId}
      AND organization_id = ${organizationId}
    RETURNING id
  `

  return result.length > 0
}

// ============================================
// Mock Route CRUD
// ============================================

/**
 * Create a new mock route
 */
export async function createMockRoute(
  interfaceId: number,
  data: CreateMockRouteRequest
): Promise<MockRoute> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO mock_routes (
      interface_id,
      path_pattern,
      method,
      description,
      priority,
      request_schema,
      response_schema,
      validate_request
    ) VALUES (
      ${interfaceId},
      ${data.path_pattern},
      ${data.method},
      ${data.description ?? null},
      ${data.priority ?? 0},
      ${data.request_schema ? JSON.stringify(data.request_schema) : null},
      ${data.response_schema ? JSON.stringify(data.response_schema) : null},
      ${data.validate_request ?? false}
    )
    RETURNING *
  `

  return result[0] as MockRoute
}

/**
 * Get all routes for an interface with rule counts
 */
export async function getMockRoutes(
  interfaceId: number
): Promise<MockRouteWithRuleCount[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      mr.*,
      COALESCE(COUNT(mrr.id), 0)::int as rule_count,
      COALESCE(SUM(mrr.hit_count), 0)::int as hit_count
    FROM mock_routes mr
    LEFT JOIN mock_response_rules mrr ON mrr.route_id = mr.id
    WHERE mr.interface_id = ${interfaceId}
    GROUP BY mr.id
    ORDER BY mr.priority DESC, mr.created_at DESC
  `

  return result as MockRouteWithRuleCount[]
}

/**
 * Get a mock route by ID
 */
export async function getMockRouteById(routeId: number): Promise<MockRoute | null> {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM mock_routes WHERE id = ${routeId}
  `

  return result.length > 0 ? (result[0] as MockRoute) : null
}

/**
 * Update a mock route
 */
export async function updateMockRoute(
  routeId: number,
  data: UpdateMockRouteRequest
): Promise<MockRoute | null> {
  const sql = getSql()

  const result = await sql`
    UPDATE mock_routes
    SET
      path_pattern = COALESCE(${data.path_pattern ?? null}, path_pattern),
      method = COALESCE(${data.method ?? null}, method),
      description = COALESCE(${data.description}, description),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      priority = COALESCE(${data.priority ?? null}, priority),
      request_schema = CASE
        WHEN ${data.request_schema !== undefined} THEN ${data.request_schema ? JSON.stringify(data.request_schema) : null}::jsonb
        ELSE request_schema
      END,
      response_schema = CASE
        WHEN ${data.response_schema !== undefined} THEN ${data.response_schema ? JSON.stringify(data.response_schema) : null}::jsonb
        ELSE response_schema
      END,
      validate_request = COALESCE(${data.validate_request ?? null}, validate_request),
      updated_at = NOW()
    WHERE id = ${routeId}
    RETURNING *
  `

  return result.length > 0 ? (result[0] as MockRoute) : null
}

/**
 * Delete a mock route (cascades to rules)
 */
export async function deleteMockRoute(routeId: number): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    DELETE FROM mock_routes
    WHERE id = ${routeId}
    RETURNING id
  `

  return result.length > 0
}

// ============================================
// Mock Response Rule CRUD
// ============================================

/**
 * Create a new response rule
 */
export async function createMockResponseRule(
  routeId: number,
  data: CreateMockResponseRuleRequest
): Promise<MockResponseRule> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO mock_response_rules (
      route_id,
      name,
      match_headers,
      match_query,
      match_body,
      match_body_contains,
      response_status,
      response_headers,
      response_body,
      response_delay_ms,
      priority
    ) VALUES (
      ${routeId},
      ${data.name},
      ${data.match_headers ? JSON.stringify(data.match_headers) : null},
      ${data.match_query ? JSON.stringify(data.match_query) : null},
      ${data.match_body ? JSON.stringify(data.match_body) : null},
      ${data.match_body_contains ?? null},
      ${data.response_status},
      ${JSON.stringify(data.response_headers ?? { "Content-Type": "application/json" })},
      ${data.response_body ?? null},
      ${data.response_delay_ms ?? 0},
      ${data.priority ?? 0}
    )
    RETURNING *
  `

  return result[0] as MockResponseRule
}

/**
 * Get all response rules for a route
 */
export async function getMockResponseRules(
  routeId: number
): Promise<MockResponseRule[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_response_rules
    WHERE route_id = ${routeId}
    ORDER BY priority DESC, created_at DESC
  `

  return result as MockResponseRule[]
}

/**
 * Get a response rule by ID
 */
export async function getMockResponseRuleById(
  ruleId: number
): Promise<MockResponseRule | null> {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM mock_response_rules WHERE id = ${ruleId}
  `

  return result.length > 0 ? (result[0] as MockResponseRule) : null
}

/**
 * Update a response rule
 */
export async function updateMockResponseRule(
  ruleId: number,
  data: UpdateMockResponseRuleRequest
): Promise<MockResponseRule | null> {
  const sql = getSql()

  const result = await sql`
    UPDATE mock_response_rules
    SET
      name = COALESCE(${data.name ?? null}, name),
      match_headers = CASE
        WHEN ${data.match_headers !== undefined} THEN ${data.match_headers ? JSON.stringify(data.match_headers) : null}::jsonb
        ELSE match_headers
      END,
      match_query = CASE
        WHEN ${data.match_query !== undefined} THEN ${data.match_query ? JSON.stringify(data.match_query) : null}::jsonb
        ELSE match_query
      END,
      match_body = CASE
        WHEN ${data.match_body !== undefined} THEN ${data.match_body ? JSON.stringify(data.match_body) : null}::jsonb
        ELSE match_body
      END,
      match_body_contains = CASE
        WHEN ${data.match_body_contains !== undefined} THEN ${data.match_body_contains}
        ELSE match_body_contains
      END,
      response_status = COALESCE(${data.response_status ?? null}, response_status),
      response_headers = CASE
        WHEN ${data.response_headers !== undefined} THEN ${JSON.stringify(data.response_headers)}::jsonb
        ELSE response_headers
      END,
      response_body = CASE
        WHEN ${data.response_body !== undefined} THEN ${data.response_body}
        ELSE response_body
      END,
      response_delay_ms = COALESCE(${data.response_delay_ms ?? null}, response_delay_ms),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      priority = COALESCE(${data.priority ?? null}, priority),
      updated_at = NOW()
    WHERE id = ${ruleId}
    RETURNING *
  `

  return result.length > 0 ? (result[0] as MockResponseRule) : null
}

/**
 * Delete a response rule
 */
export async function deleteMockResponseRule(ruleId: number): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    DELETE FROM mock_response_rules
    WHERE id = ${ruleId}
    RETURNING id
  `

  return result.length > 0
}

/**
 * Increment hit count for a rule
 */
export async function incrementRuleHitCount(ruleId: number): Promise<void> {
  const sql = getSql()

  await sql`
    UPDATE mock_response_rules
    SET
      hit_count = hit_count + 1,
      last_hit_at = NOW()
    WHERE id = ${ruleId}
  `
}

// ============================================
// Public Route Matching (for mock handler)
// ============================================

/**
 * Get active routes for an interface, ordered by priority
 */
export async function getActiveRoutesForInterface(
  interfaceId: number
): Promise<MockRoute[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_routes
    WHERE interface_id = ${interfaceId}
      AND is_active = true
    ORDER BY priority DESC, created_at ASC
  `

  return result as MockRoute[]
}

/**
 * Get active rules for a route, ordered by priority
 */
export async function getActiveRulesForRoute(
  routeId: number
): Promise<MockResponseRule[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_response_rules
    WHERE route_id = ${routeId}
      AND is_active = true
    ORDER BY priority DESC, created_at ASC
  `

  return result as MockResponseRule[]
}

// ============================================
// Request Logging
// ============================================

/**
 * Log a mock request
 */
export async function logMockRequest(data: {
  interface_id: number
  route_id: number | null
  rule_id: number | null
  method: string
  path: string
  headers: Record<string, string> | null
  query_params: Record<string, string> | null
  body: string | null
  response_status: number | null
  response_body: string | null
  matched: boolean
  response_time_ms: number | null
  // Note: validation_errors is accepted but not stored until migration 021 is run
  validation_errors?: Array<{ path: string; message: string; keyword: string }> | null
}): Promise<void> {
  const sql = getSql()

  // Note: validation_errors column removed from INSERT for backwards compatibility
  // Run scripts/021_add_mock_schemas.sql to enable validation_errors storage
  await sql`
    INSERT INTO mock_request_logs (
      interface_id,
      route_id,
      rule_id,
      method,
      path,
      headers,
      query_params,
      body,
      response_status,
      response_body,
      matched,
      response_time_ms
    ) VALUES (
      ${data.interface_id},
      ${data.route_id},
      ${data.rule_id},
      ${data.method},
      ${data.path},
      ${data.headers ? JSON.stringify(data.headers) : null},
      ${data.query_params ? JSON.stringify(data.query_params) : null},
      ${data.body},
      ${data.response_status},
      ${data.response_body},
      ${data.matched},
      ${data.response_time_ms}
    )
  `
}

/**
 * Get request logs for an interface
 */
export async function getMockRequestLogs(
  interfaceId: number,
  limit = 100
): Promise<MockRequestLog[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_request_logs
    WHERE interface_id = ${interfaceId}
    ORDER BY request_at DESC
    LIMIT ${limit}
  `

  return result as MockRequestLog[]
}

/**
 * Filter options for request logs
 */
export interface MockRequestLogFilters {
  path?: string
  method?: string
  statusMin?: number
  statusMax?: number
  matched?: boolean
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

/**
 * Get filtered request logs with pagination
 */
export async function getMockRequestLogsFiltered(
  interfaceId: number,
  filters: MockRequestLogFilters = {}
): Promise<{ logs: MockRequestLog[]; total: number }> {
  const sql = getSql()

  const {
    path,
    method,
    statusMin,
    statusMax,
    matched,
    from,
    to,
    limit = 100,
    offset = 0,
  } = filters

  // Build dynamic WHERE conditions
  const conditions: string[] = [`interface_id = ${interfaceId}`]

  if (path) {
    conditions.push(`path ILIKE '%${path.replace(/'/g, "''")}%'`)
  }

  if (method) {
    conditions.push(`method = '${method.replace(/'/g, "''")}'`)
  }

  if (statusMin !== undefined) {
    conditions.push(`response_status >= ${statusMin}`)
  }

  if (statusMax !== undefined) {
    conditions.push(`response_status <= ${statusMax}`)
  }

  if (matched !== undefined) {
    conditions.push(`matched = ${matched}`)
  }

  if (from) {
    conditions.push(`request_at >= '${from.toISOString()}'`)
  }

  if (to) {
    conditions.push(`request_at <= '${to.toISOString()}'`)
  }

  const whereClause = conditions.join(" AND ")

  // Get total count
  const countResult = await sql.unsafe(`
    SELECT COUNT(*) as count
    FROM mock_request_logs
    WHERE ${whereClause}
  `)
  const total = Number(countResult[0]?.count ?? 0)

  // Get filtered logs
  const result = await sql.unsafe(`
    SELECT *
    FROM mock_request_logs
    WHERE ${whereClause}
    ORDER BY request_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  return { logs: result as MockRequestLog[], total }
}

/**
 * Get log statistics for an interface
 */
export async function getMockLogStats(interfaceId: number): Promise<{
  total: number
  matched: number
  unmatched: number
  byStatus: { status: string; count: number }[]
  byMethod: { method: string; count: number }[]
}> {
  const sql = getSql()

  // Total and matched counts
  const countsResult = await sql`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN matched THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN NOT matched THEN 1 ELSE 0 END) as unmatched
    FROM mock_request_logs
    WHERE interface_id = ${interfaceId}
  `

  // By status group
  const byStatusResult = await sql`
    SELECT
      CASE
        WHEN response_status >= 200 AND response_status < 300 THEN '2xx'
        WHEN response_status >= 300 AND response_status < 400 THEN '3xx'
        WHEN response_status >= 400 AND response_status < 500 THEN '4xx'
        WHEN response_status >= 500 THEN '5xx'
        ELSE 'other'
      END as status,
      COUNT(*) as count
    FROM mock_request_logs
    WHERE interface_id = ${interfaceId}
    GROUP BY status
    ORDER BY status
  `

  // By method
  const byMethodResult = await sql`
    SELECT method, COUNT(*) as count
    FROM mock_request_logs
    WHERE interface_id = ${interfaceId}
    GROUP BY method
    ORDER BY count DESC
  `

  return {
    total: Number(countsResult[0]?.total ?? 0),
    matched: Number(countsResult[0]?.matched ?? 0),
    unmatched: Number(countsResult[0]?.unmatched ?? 0),
    byStatus: byStatusResult.map((r) => ({
      status: String(r.status),
      count: Number(r.count),
    })),
    byMethod: byMethodResult.map((r) => ({
      method: String(r.method),
      count: Number(r.count),
    })),
  }
}

// ============================================
// Rate Limiting
// ============================================

/**
 * Check rate limit for an interface
 * Returns remaining requests in the current window
 */
export async function checkRateLimit(
  interfaceId: number,
  rateLimitRpm: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const sql = getSql()

  // Count hits in the last minute
  const countResult = await sql`
    SELECT COUNT(*) as count
    FROM mock_rate_limit_hits
    WHERE interface_id = ${interfaceId}
      AND hit_at > NOW() - INTERVAL '1 minute'
  `

  const count = Number(countResult[0]?.count ?? 0)
  const remaining = Math.max(0, rateLimitRpm - count)
  const allowed = count < rateLimitRpm

  // If allowed, record the hit
  if (allowed) {
    await sql`
      INSERT INTO mock_rate_limit_hits (interface_id)
      VALUES (${interfaceId})
    `
  }

  // Calculate reset time (next minute boundary)
  const now = new Date()
  const resetAt = new Date(now.getTime() + (60 - now.getSeconds()) * 1000)

  return { allowed, remaining: remaining - (allowed ? 1 : 0), resetAt }
}

/**
 * Cleanup old rate limit hits (call periodically)
 */
export async function cleanupRateLimitHits(): Promise<number> {
  const sql = getSql()

  const result = await sql`
    DELETE FROM mock_rate_limit_hits
    WHERE hit_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  `

  return result.length
}

// ============================================
// Mock Webhook Actions CRUD
// ============================================

import type {
  MockWebhookAction,
  MockWebhookLog,
  CreateMockWebhookActionRequest,
  UpdateMockWebhookActionRequest,
} from "@/lib/types"

/**
 * Create a new webhook action for a rule
 */
export async function createMockWebhookAction(
  ruleId: number,
  data: CreateMockWebhookActionRequest
): Promise<MockWebhookAction> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO mock_webhook_actions (
      rule_id,
      name,
      target_url,
      target_method,
      target_headers,
      target_body,
      forward_request_body,
      forward_request_headers,
      timeout_ms,
      retry_count
    ) VALUES (
      ${ruleId},
      ${data.name},
      ${data.target_url},
      ${data.target_method ?? "POST"},
      ${JSON.stringify(data.target_headers ?? {})},
      ${data.target_body ?? null},
      ${data.forward_request_body ?? false},
      ${data.forward_request_headers ?? false},
      ${data.timeout_ms ?? 5000},
      ${data.retry_count ?? 0}
    )
    RETURNING *
  `

  return result[0] as MockWebhookAction
}

/**
 * Get all webhook actions for a rule
 */
export async function getMockWebhookActions(
  ruleId: number
): Promise<MockWebhookAction[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_webhook_actions
    WHERE rule_id = ${ruleId}
    ORDER BY created_at ASC
  `

  return result as MockWebhookAction[]
}

/**
 * Get active webhook actions for a rule
 * Returns empty array if webhook feature tables don't exist yet
 */
export async function getActiveWebhookActions(
  ruleId: number
): Promise<MockWebhookAction[]> {
  const sql = getSql()

  try {
    const result = await sql`
      SELECT *
      FROM mock_webhook_actions
      WHERE rule_id = ${ruleId}
        AND is_active = true
      ORDER BY created_at ASC
    `

    return result as MockWebhookAction[]
  } catch (error) {
    // Table may not exist if migration 022 hasn't been run
    // Return empty array to allow mock handler to work without webhooks
    if (error instanceof Error && error.message.includes("does not exist")) {
      return []
    }
    throw error
  }
}

/**
 * Get a webhook action by ID
 */
export async function getMockWebhookActionById(
  actionId: number
): Promise<MockWebhookAction | null> {
  const sql = getSql()

  const result = await sql`
    SELECT * FROM mock_webhook_actions WHERE id = ${actionId}
  `

  return result.length > 0 ? (result[0] as MockWebhookAction) : null
}

/**
 * Update a webhook action
 */
export async function updateMockWebhookAction(
  actionId: number,
  data: UpdateMockWebhookActionRequest
): Promise<MockWebhookAction | null> {
  const sql = getSql()

  const result = await sql`
    UPDATE mock_webhook_actions
    SET
      name = COALESCE(${data.name ?? null}, name),
      target_url = COALESCE(${data.target_url ?? null}, target_url),
      target_method = COALESCE(${data.target_method ?? null}, target_method),
      target_headers = CASE
        WHEN ${data.target_headers !== undefined} THEN ${JSON.stringify(data.target_headers ?? {})}::jsonb
        ELSE target_headers
      END,
      target_body = CASE
        WHEN ${data.target_body !== undefined} THEN ${data.target_body}
        ELSE target_body
      END,
      forward_request_body = COALESCE(${data.forward_request_body ?? null}, forward_request_body),
      forward_request_headers = COALESCE(${data.forward_request_headers ?? null}, forward_request_headers),
      timeout_ms = COALESCE(${data.timeout_ms ?? null}, timeout_ms),
      retry_count = COALESCE(${data.retry_count ?? null}, retry_count),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${actionId}
    RETURNING *
  `

  return result.length > 0 ? (result[0] as MockWebhookAction) : null
}

/**
 * Delete a webhook action
 */
export async function deleteMockWebhookAction(actionId: number): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    DELETE FROM mock_webhook_actions
    WHERE id = ${actionId}
    RETURNING id
  `

  return result.length > 0
}

// ============================================
// Mock Webhook Logs
// ============================================

/**
 * Log a webhook execution
 */
export async function logWebhookExecution(data: {
  action_id: number
  request_log_id: number | null
  request_url: string
  request_method: string
  request_headers: Record<string, string> | null
  request_body: string | null
  response_status: number | null
  response_headers: Record<string, string> | null
  response_body: string | null
  success: boolean
  error_message: string | null
  duration_ms: number | null
  retry_attempt: number
}): Promise<MockWebhookLog> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO mock_webhook_logs (
      action_id,
      request_log_id,
      request_url,
      request_method,
      request_headers,
      request_body,
      response_status,
      response_headers,
      response_body,
      success,
      error_message,
      duration_ms,
      retry_attempt
    ) VALUES (
      ${data.action_id},
      ${data.request_log_id},
      ${data.request_url},
      ${data.request_method},
      ${data.request_headers ? JSON.stringify(data.request_headers) : null},
      ${data.request_body},
      ${data.response_status},
      ${data.response_headers ? JSON.stringify(data.response_headers) : null},
      ${data.response_body},
      ${data.success},
      ${data.error_message},
      ${data.duration_ms},
      ${data.retry_attempt}
    )
    RETURNING *
  `

  return result[0] as MockWebhookLog
}

/**
 * Get webhook logs for an action
 */
export async function getMockWebhookLogs(
  actionId: number,
  limit = 100
): Promise<MockWebhookLog[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_webhook_logs
    WHERE action_id = ${actionId}
    ORDER BY executed_at DESC
    LIMIT ${limit}
  `

  return result as MockWebhookLog[]
}

/**
 * Get webhook logs by request log ID
 */
export async function getWebhookLogsByRequestLog(
  requestLogId: number
): Promise<MockWebhookLog[]> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM mock_webhook_logs
    WHERE request_log_id = ${requestLogId}
    ORDER BY executed_at ASC
  `

  return result as MockWebhookLog[]
}

// ============================================
// Public Mock Logs (no auth required)
// ============================================

/**
 * Filter options for public mock logs
 */
export interface PublicMockLogFilters {
  since?: string // ISO8601 timestamp, defaults to 5 minutes ago
  limit?: number // 1-500, defaults to 50
  path?: string // Partial match
  method?: string // GET, POST, etc.
}

/**
 * Get mock logs publicly by org slug and interface slug.
 * Optimized for test scenario validation.
 */
export async function getPublicMockLogs(
  orgSlug: string,
  interfaceSlug: string,
  filters: PublicMockLogFilters = {}
): Promise<{
  interface: { name: string; slug: string } | null
  logs: MockRequestLog[]
  count: number
}> {
  const sql = getSql()

  // First, look up the interface by slugs
  const interfaceResult = await sql`
    SELECT mi.id, mi.name, mi.slug, mi.is_active
    FROM mock_interfaces mi
    JOIN organizations o ON o.id = mi.organization_id
    WHERE o.slug = ${orgSlug}
      AND mi.slug = ${interfaceSlug}
  `

  if (interfaceResult.length === 0) {
    return { interface: null, logs: [], count: 0 }
  }

  const mockInterface = interfaceResult[0]

  // Check if interface is active
  if (!mockInterface.is_active) {
    return { interface: null, logs: [], count: 0 }
  }

  // Apply filters
  const {
    since,
    limit = 50,
    path,
    method,
  } = filters

  // Default since to 5 minutes ago if not provided
  const sinceDate = since
    ? new Date(since)
    : new Date(Date.now() - 5 * 60 * 1000)

  // Clamp limit to 1-500
  const clampedLimit = Math.min(Math.max(1, limit), 500)

  // Get logs using parameterized query
  const interfaceId = mockInterface.id as number

  let result
  if (path && method) {
    result = await sql`
      SELECT * FROM mock_request_logs
      WHERE interface_id = ${interfaceId}
        AND request_at >= ${sinceDate.toISOString()}
        AND path ILIKE ${'%' + path + '%'}
        AND method = ${method.toUpperCase()}
      ORDER BY request_at DESC
      LIMIT ${clampedLimit}
    `
  } else if (path) {
    result = await sql`
      SELECT * FROM mock_request_logs
      WHERE interface_id = ${interfaceId}
        AND request_at >= ${sinceDate.toISOString()}
        AND path ILIKE ${'%' + path + '%'}
      ORDER BY request_at DESC
      LIMIT ${clampedLimit}
    `
  } else if (method) {
    result = await sql`
      SELECT * FROM mock_request_logs
      WHERE interface_id = ${interfaceId}
        AND request_at >= ${sinceDate.toISOString()}
        AND method = ${method.toUpperCase()}
      ORDER BY request_at DESC
      LIMIT ${clampedLimit}
    `
  } else {
    result = await sql`
      SELECT * FROM mock_request_logs
      WHERE interface_id = ${interfaceId}
        AND request_at >= ${sinceDate.toISOString()}
      ORDER BY request_at DESC
      LIMIT ${clampedLimit}
    `
  }

  return {
    interface: {
      name: mockInterface.name as string,
      slug: mockInterface.slug as string,
    },
    logs: result as MockRequestLog[],
    count: result.length,
  }
}
