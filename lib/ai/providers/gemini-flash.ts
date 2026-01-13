/**
 * Gemini 2.0 Flash Provider
 *
 * Provides text generation capabilities using Google's Gemini 2.0 Flash model.
 * Optimized for Q&A about test results with streaming support.
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"

// ============================================
// Configuration
// ============================================

let genAI: GoogleGenerativeAI | null = null
let flashModel: GenerativeModel | null = null

/**
 * Get the Google Generative AI client
 */
function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINIAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "GEMINIAI_API_KEY environment variable is required for Gemini Flash"
      )
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

/**
 * Get the Gemini 2.0 Flash model
 */
function getFlashModel(): GenerativeModel {
  if (!flashModel) {
    flashModel = getGenAI().getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    })
  }
  return flashModel
}

// ============================================
// Types
// ============================================

export interface GenerateAnswerOptions {
  maxTokens?: number
  temperature?: number
  onChunk?: (text: string) => void
}

export interface SearchResult {
  testName: string
  testFile?: string | null
  status: string
  errorMessage?: string | null
  similarity?: number
}

// ============================================
// Answer Generation
// ============================================

/**
 * Generate an AI answer based on search context
 *
 * @param query - User's question
 * @param context - Context from search results
 * @param options - Generation options including streaming callback
 * @returns Full generated answer
 *
 * @example
 * // Non-streaming
 * const answer = await generateAnswer("Why are tests failing?", context)
 *
 * // Streaming
 * const answer = await generateAnswer("Why are tests failing?", context, {
 *   onChunk: (text) => console.log(text)
 * })
 */
export async function generateAnswer(
  query: string,
  context: string,
  options?: GenerateAnswerOptions
): Promise<string> {
  const model = getFlashModel()

  const systemPrompt = `You are an AI assistant specialized in analyzing Playwright test results for a QA dashboard called Exolar QA.

Your role is to:
1. Analyze test failures and their patterns
2. Identify potential root causes
3. Suggest fixes or debugging steps
4. Highlight any patterns in the failures

Guidelines:
- Be concise and actionable
- Focus on the most likely causes first
- Use technical but accessible language
- Reference specific test names and error messages when relevant
- If you don't have enough context, say so

Format your response with:
- A brief summary (1-2 sentences)
- Key findings (bullet points)
- Suggested actions (if applicable)`

  const prompt = `${systemPrompt}

## Test Results Context
${context}

## User Question
${query}

Please provide a helpful analysis.`

  if (options?.onChunk) {
    // Streaming mode
    const stream = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      },
    })

    let fullText = ""
    for await (const chunk of stream.stream) {
      const text = chunk.text()
      fullText += text
      options.onChunk(text)
    }
    return fullText
  }

  // Non-streaming mode
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
    },
  })

  return result.response.text()
}

/**
 * Build context string from search results
 *
 * @param searchResults - Array of search results
 * @param maxResults - Maximum results to include (default: 10)
 * @returns Formatted context string
 */
export function buildContextFromResults(
  searchResults: SearchResult[],
  maxResults: number = 10
): string {
  const limited = searchResults.slice(0, maxResults)

  if (limited.length === 0) {
    return "No relevant test results found."
  }

  const lines = limited.map((r, i) => {
    const parts = [`${i + 1}. **${r.testName}**`]

    if (r.testFile) {
      parts.push(`   File: ${r.testFile}`)
    }

    parts.push(`   Status: ${r.status}`)

    if (r.errorMessage) {
      // Truncate error message to 300 chars
      const truncatedError =
        r.errorMessage.length > 300
          ? r.errorMessage.slice(0, 300) + "..."
          : r.errorMessage
      parts.push(`   Error: ${truncatedError}`)
    }

    if (r.similarity !== undefined) {
      parts.push(`   Relevance: ${(r.similarity * 100).toFixed(0)}%`)
    }

    return parts.join("\n")
  })

  return lines.join("\n\n")
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if Gemini Flash is available
 */
export function isGeminiFlashAvailable(): boolean {
  return !!process.env.GEMINIAI_API_KEY
}

/**
 * Get model info for debugging
 */
export function getGeminiFlashInfo(): {
  available: boolean
  model: string
  capabilities: string[]
} {
  return {
    available: isGeminiFlashAvailable(),
    model: "gemini-2.0-flash-exp",
    capabilities: ["text-generation", "streaming", "q-and-a"],
  }
}
