/**
 * AI Q&A API: Answer questions about test results
 *
 * POST /api/search/answers
 *
 * Uses Gemini 2.0 Flash to analyze search results and answer user questions.
 * Supports streaming responses via Server-Sent Events.
 *
 * Body:
 * - query: string (the user's question)
 * - searchResults: Array of search results to use as context
 * - streaming?: boolean (default: true)
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import {
  generateAnswer,
  buildContextFromResults,
  isGeminiFlashAvailable,
  type SearchResult,
} from "@/lib/ai/providers"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // 1 minute for streaming

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const context = await getSessionContext()
    if (!context) {
      return unauthorized()
    }

    // Check if Gemini Flash is available
    if (!isGeminiFlashAvailable()) {
      return NextResponse.json(
        { error: "AI Q&A is not configured. GEMINIAI_API_KEY is required." },
        { status: 503 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { query, searchResults, streaming = true } = body as {
      query: string
      searchResults: SearchResult[]
      streaming?: boolean
    }

    // Validate input
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      )
    }

    if (!Array.isArray(searchResults)) {
      return NextResponse.json(
        { error: "searchResults must be an array" },
        { status: 400 }
      )
    }

    // Build context from search results
    const contextStr = buildContextFromResults(searchResults, 10)

    if (streaming) {
      // Streaming mode using Server-Sent Events
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          try {
            await generateAnswer(query, contextStr, {
              onChunk: (text) => {
                const data = JSON.stringify({ text })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              },
            })

            // Signal completion
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            controller.close()
          } catch (error) {
            console.error("Streaming error:", error)

            // Detect quota/rate limit errors
            let errorMsg = "Failed to generate answer"
            if (error instanceof Error) {
              if (error.message.includes("429") || error.message.includes("quota") || error.message.includes("Too Many Requests")) {
                errorMsg = "AI quota exceeded. Please try again later or upgrade your Gemini API plan."
              } else {
                errorMsg = error.message
              }
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // Non-streaming mode
    const answer = await generateAnswer(query, contextStr)

    return NextResponse.json({
      answer,
      contextUsed: searchResults.length,
    })
  } catch (error) {
    console.error("AI Q&A error:", error)
    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 500 }
    )
  }
}

/**
 * GET: Check if AI Q&A is available
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return unauthorized()
    }

    const available = isGeminiFlashAvailable()

    return NextResponse.json({
      available,
      model: "gemini-2.0-flash-exp",
      capabilities: ["text-generation", "streaming", "q-and-a"],
      message: available
        ? "AI Q&A is ready"
        : "AI Q&A is not configured. Set GEMINIAI_API_KEY.",
    })
  } catch (error) {
    console.error("Check AI Q&A error:", error)
    return NextResponse.json(
      { error: "Failed to check AI Q&A status" },
      { status: 500 }
    )
  }
}
