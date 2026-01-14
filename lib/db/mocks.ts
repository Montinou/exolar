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
      priority
    ) VALUES (
      ${interfaceId},
      ${data.path_pattern},
      ${data.method},
      ${data.description ?? null},
      ${data.priority ?? 0}
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
}): Promise<void> {
  const sql = getSql()

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
