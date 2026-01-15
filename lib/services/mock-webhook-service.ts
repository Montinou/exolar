import { processTemplate } from "@/lib/mock-utils"
import type { MockWebhookAction, MockRequestContext } from "@/lib/types"

export interface WebhookExecutionResult {
  success: boolean
  responseStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  errorMessage?: string
  durationMs: number
}

export interface WebhookExecutionContext {
  action: MockWebhookAction
  requestContext: MockRequestContext
  originalRequest: {
    body: unknown
    headers: Record<string, string>
  }
}

/**
 * Execute a webhook action with retry support
 */
export async function executeWebhook(
  ctx: WebhookExecutionContext,
  retryAttempt = 0
): Promise<WebhookExecutionResult> {
  const { action, requestContext, originalRequest } = ctx
  const startTime = Date.now()

  try {
    // Build target URL (supports templating)
    const targetUrl = processTemplate(action.target_url, requestContext)

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(action.target_headers || {}),
    }

    // Forward original headers if configured
    if (action.forward_request_headers) {
      // Only forward safe headers
      const safeHeaders = ["content-type", "accept", "authorization", "x-request-id", "x-correlation-id"]
      for (const [key, value] of Object.entries(originalRequest.headers)) {
        if (safeHeaders.includes(key.toLowerCase())) {
          headers[key] = value
        }
      }
    }

    // Build body
    let body: string | undefined
    if (action.forward_request_body) {
      body =
        typeof originalRequest.body === "string"
          ? originalRequest.body
          : JSON.stringify(originalRequest.body)
    } else if (action.target_body) {
      body = processTemplate(action.target_body, requestContext)
    }

    // Execute request with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), action.timeout_ms)

    try {
      const response = await fetch(targetUrl, {
        method: action.target_method,
        headers,
        body: action.target_method !== "GET" ? body : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const responseBody = await response.text()
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const result: WebhookExecutionResult = {
        success: response.ok,
        responseStatus: response.status,
        responseHeaders,
        responseBody,
        durationMs: Date.now() - startTime,
      }

      // If failed and retries remaining, retry
      if (!response.ok && retryAttempt < action.retry_count) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryAttempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        return executeWebhook(ctx, retryAttempt + 1)
      }

      return result
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    const durationMs = Date.now() - startTime

    // If retries remaining and it's a network error, retry
    if (retryAttempt < action.retry_count) {
      const delay = Math.pow(2, retryAttempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
      return executeWebhook(ctx, retryAttempt + 1)
    }

    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs,
    }
  }
}

/**
 * Execute multiple webhooks in parallel
 */
export async function executeWebhooks(
  actions: MockWebhookAction[],
  requestContext: MockRequestContext,
  originalRequest: { body: unknown; headers: Record<string, string> }
): Promise<Array<{ action: MockWebhookAction; result: WebhookExecutionResult }>> {
  const activeActions = actions.filter((a) => a.is_active)

  if (activeActions.length === 0) {
    return []
  }

  const results = await Promise.all(
    activeActions.map(async (action) => {
      const result = await executeWebhook({
        action,
        requestContext,
        originalRequest,
      })
      return { action, result }
    })
  )

  return results
}
