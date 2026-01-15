import { NextRequest, NextResponse } from "next/server"
import {
  getMockInterfaceBySlug,
  getActiveRoutesForInterface,
  getActiveRulesForRoute,
  logMockRequest,
  incrementRuleHitCount,
  checkRateLimit,
  getActiveWebhookActions,
  logWebhookExecution,
} from "@/lib/db"
import {
  matchPath,
  matchRule,
  processTemplate,
  parseRequestBody,
  headersToObject,
  searchParamsToObject,
} from "@/lib/mock-utils"
import { validateRequestBody } from "@/lib/mock-schema-validator"
import { executeWebhooks } from "@/lib/services/mock-webhook-service"
import type { MockRequestContext, MockRoute, MockResponseRule } from "@/lib/types"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ orgSlug: string; interfaceSlug: string; path: string[] }>
}

/**
 * Handle mock request - supports all HTTP methods
 */
async function handleMockRequest(
  request: NextRequest,
  params: { orgSlug: string; interfaceSlug: string; path: string[] },
  method: string
): Promise<NextResponse> {
  const startTime = Date.now()
  const { orgSlug, interfaceSlug, path } = params
  const requestPath = "/" + (path?.join("/") || "")

  // Prepare request context for logging
  const requestHeaders = headersToObject(request.headers)
  const requestQuery = searchParamsToObject(request.nextUrl.searchParams)
  let requestBody: unknown = null

  try {
    // Parse request body for methods that support it
    if (["POST", "PUT", "PATCH"].includes(method)) {
      requestBody = await parseRequestBody(request)
    }
  } catch {
    // Body parsing failed, continue with null body
  }

  try {
    // 1. Find the mock interface
    const mockInterface = await getMockInterfaceBySlug(orgSlug, interfaceSlug)
    if (!mockInterface) {
      return createErrorResponse(404, "Mock interface not found", {
        orgSlug,
        interfaceSlug,
      })
    }

    // 2. Check rate limit
    const rateLimit = await checkRateLimit(mockInterface.id, mockInterface.rate_limit_rpm)
    if (!rateLimit.allowed) {
      // Log the rate-limited request
      await logMockRequest({
        interface_id: mockInterface.id,
        route_id: null,
        rule_id: null,
        method,
        path: requestPath,
        headers: requestHeaders,
        query_params: requestQuery,
        body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody),
        response_status: 429,
        response_body: JSON.stringify({ error: "Rate limit exceeded" }),
        matched: false,
        response_time_ms: Date.now() - startTime,
      })

      return createRateLimitResponse(rateLimit.remaining, mockInterface.rate_limit_rpm, rateLimit.resetAt)
    }

    // 3. Get active routes and find matching route
    const routes = await getActiveRoutesForInterface(mockInterface.id)
    const matchedRoute = findMatchingRoute(routes, requestPath, method)

    if (!matchedRoute) {
      // Log unmatched request
      await logMockRequest({
        interface_id: mockInterface.id,
        route_id: null,
        rule_id: null,
        method,
        path: requestPath,
        headers: requestHeaders,
        query_params: requestQuery,
        body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody),
        response_status: 404,
        response_body: JSON.stringify({ error: "No matching route" }),
        matched: false,
        response_time_ms: Date.now() - startTime,
      })

      return createErrorResponse(404, "No matching route", {
        path: requestPath,
        method,
      })
    }

    // 4. Validate request body against schema (if enabled)
    if (matchedRoute.route.validate_request && matchedRoute.route.request_schema) {
      const validation = validateRequestBody(requestBody, matchedRoute.route.request_schema)
      if (!validation.valid) {
        const errorResponse = {
          error: "Request validation failed",
          validation_errors: validation.errors,
        }

        // Log validation failure
        await logMockRequest({
          interface_id: mockInterface.id,
          route_id: matchedRoute.route.id,
          rule_id: null,
          method,
          path: requestPath,
          headers: requestHeaders,
          query_params: requestQuery,
          body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody),
          response_status: 400,
          response_body: JSON.stringify(errorResponse),
          matched: false,
          response_time_ms: Date.now() - startTime,
          validation_errors: validation.errors,
        })

        return NextResponse.json(errorResponse, { status: 400 })
      }
    }

    // 5. Build request context for rule matching
    const requestContext: MockRequestContext = {
      headers: requestHeaders,
      query: requestQuery,
      body: requestBody,
      params: matchedRoute.params,
    }

    // 5. Get active rules and find matching rule
    const rules = await getActiveRulesForRoute(matchedRoute.route.id)
    const matchedRule = findMatchingRule(rules, requestContext)

    if (!matchedRule) {
      // Log unmatched request
      await logMockRequest({
        interface_id: mockInterface.id,
        route_id: matchedRoute.route.id,
        rule_id: null,
        method,
        path: requestPath,
        headers: requestHeaders,
        query_params: requestQuery,
        body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody),
        response_status: 404,
        response_body: JSON.stringify({ error: "No matching rule" }),
        matched: false,
        response_time_ms: Date.now() - startTime,
      })

      return createErrorResponse(404, "No matching rule for this request", {
        path: requestPath,
        method,
        route: matchedRoute.route.path_pattern,
      })
    }

    // 6. Apply response delay if configured
    if (matchedRule.response_delay_ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, matchedRule.response_delay_ms))
    }

    // 7. Process response body templating
    let responseBody = matchedRule.response_body || ""
    if (responseBody) {
      responseBody = processTemplate(responseBody, requestContext)
    }

    // 8. Update hit count (async, don't wait)
    incrementRuleHitCount(matchedRule.id).catch(console.error)

    // 9. Log the successful request
    await logMockRequest({
      interface_id: mockInterface.id,
      route_id: matchedRoute.route.id,
      rule_id: matchedRule.id,
      method,
      path: requestPath,
      headers: requestHeaders,
      query_params: requestQuery,
      body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody),
      response_status: matchedRule.response_status,
      response_body: responseBody,
      matched: true,
      response_time_ms: Date.now() - startTime,
    })

    // 10. Trigger webhooks asynchronously (fire and forget)
    const webhookActions = await getActiveWebhookActions(matchedRule.id)
    if (webhookActions.length > 0) {
      // Execute webhooks in background, don't block the response
      executeWebhooks(webhookActions, requestContext, {
        body: requestBody,
        headers: requestHeaders,
      })
        .then(async (results) => {
          // Log webhook executions
          for (const { action, result } of results) {
            try {
              await logWebhookExecution({
                action_id: action.id,
                request_log_id: null, // We don't have the log ID here
                request_url: action.target_url,
                request_method: action.target_method,
                request_headers: action.target_headers,
                request_body: action.forward_request_body
                  ? typeof requestBody === "string"
                    ? requestBody
                    : JSON.stringify(requestBody)
                  : action.target_body,
                response_status: result.responseStatus ?? null,
                response_headers: result.responseHeaders ?? null,
                response_body: result.responseBody ?? null,
                success: result.success,
                error_message: result.errorMessage ?? null,
                duration_ms: result.durationMs,
                retry_attempt: 0,
              })
            } catch (logError) {
              console.error("[mock] Error logging webhook execution:", logError)
            }
          }
        })
        .catch((err) => {
          console.error("[mock] Error executing webhooks:", err)
        })
    }

    // 11. Build and return response
    const responseHeaders = new Headers(matchedRule.response_headers || {})

    // Add rate limit headers
    responseHeaders.set("X-RateLimit-Limit", String(mockInterface.rate_limit_rpm))
    responseHeaders.set("X-RateLimit-Remaining", String(rateLimit.remaining))
    responseHeaders.set("X-RateLimit-Reset", rateLimit.resetAt.toISOString())

    // Add mock metadata headers
    responseHeaders.set("X-Mock-Interface", interfaceSlug)
    responseHeaders.set("X-Mock-Route", matchedRoute.route.path_pattern)
    responseHeaders.set("X-Mock-Rule", matchedRule.name)

    return new NextResponse(responseBody, {
      status: matchedRule.response_status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("[mock] Error handling request:", error)

    // Log error
    try {
      const mockInterface = await getMockInterfaceBySlug(orgSlug, interfaceSlug)
      if (mockInterface) {
        await logMockRequest({
          interface_id: mockInterface.id,
          route_id: null,
          rule_id: null,
          method,
          path: requestPath,
          headers: requestHeaders,
          query_params: requestQuery,
          body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody),
          response_status: 500,
          response_body: JSON.stringify({ error: "Internal server error" }),
          matched: false,
          response_time_ms: Date.now() - startTime,
        })
      }
    } catch {
      // Ignore logging errors
    }

    return createErrorResponse(500, "Internal server error")
  }
}

/**
 * Find matching route from list
 */
function findMatchingRoute(
  routes: MockRoute[],
  path: string,
  method: string
): { route: MockRoute; params: Record<string, string> } | null {
  for (const route of routes) {
    // Check method match
    if (route.method !== "*" && route.method !== method) {
      continue
    }

    // Check path match
    const pathMatch = matchPath(route.path_pattern, path)
    if (pathMatch.matched) {
      return { route, params: pathMatch.params }
    }
  }

  return null
}

/**
 * Find matching rule from list
 */
function findMatchingRule(
  rules: MockResponseRule[],
  context: MockRequestContext
): MockResponseRule | null {
  for (const rule of rules) {
    if (matchRule(rule, context)) {
      return rule
    }
  }

  return null
}

/**
 * Create error response
 */
function createErrorResponse(
  status: number,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...details,
    },
    { status }
  )
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(
  remaining: number,
  limit: number,
  resetAt: Date
): NextResponse {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": resetAt.toISOString(),
    "Retry-After": String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  })

  return new NextResponse(
    JSON.stringify({
      error: "Rate limit exceeded",
      limit,
      remaining,
      resetAt: resetAt.toISOString(),
    }),
    {
      status: 429,
      headers,
    }
  )
}

// Export handlers for all HTTP methods
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    return handleMockRequest(request, await context.params, "GET")
  } catch (error) {
    console.error("[Mock Handler GET] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params
    console.log("[Mock Handler POST] params:", params)
    return handleMockRequest(request, params, "POST")
  } catch (error) {
    console.error("[Mock Handler POST] Error:", error instanceof Error ? error.stack : error)
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    return handleMockRequest(request, await context.params, "PUT")
  } catch (error) {
    console.error("[Mock Handler PUT] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    return handleMockRequest(request, await context.params, "DELETE")
  } catch (error) {
    console.error("[Mock Handler DELETE] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    return handleMockRequest(request, await context.params, "PATCH")
  } catch (error) {
    console.error("[Mock Handler PATCH] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function OPTIONS(request: NextRequest, context: RouteParams) {
  try {
    // Return CORS headers for preflight requests
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    })
    return new NextResponse(null, { status: 204, headers })
  } catch (error) {
    console.error("[Mock Handler OPTIONS] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
