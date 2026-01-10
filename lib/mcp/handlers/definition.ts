/**
 * Handler: get_semantic_definition
 *
 * Retorna la definición semántica de una métrica para prevenir alucinaciones.
 * Claude debe llamar esto antes de interpretar métricas que no entiende.
 */

import { z } from "zod"
import type { MCPAuthContext } from "../auth"
import { getMetricDefinitionText } from "@/lib/analytics"

const DefinitionInputSchema = z.object({
  metric_id: z.string(),
})

export type DefinitionInput = z.infer<typeof DefinitionInputSchema>

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export async function handleDefinition(
  args: Record<string, unknown>,
  _authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = DefinitionInputSchema.parse(args)

  const definition = getMetricDefinitionText(input.metric_id)

  if (!definition) {
    return errorResponse(
      `Unknown metric: ${input.metric_id}. Use explore_exolar_index(category="metrics") to see valid IDs.`
    )
  }

  return textResponse(definition)
}

function textResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
  }
}

function errorResponse(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}
