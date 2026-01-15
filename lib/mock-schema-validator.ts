import Ajv from "ajv"
import addFormats from "ajv-formats"

// Create AJV instance with common options
const ajv = new Ajv({
  allErrors: true, // Return all errors, not just the first one
  strict: false, // Allow additional keywords
  validateFormats: true,
})

// Add format validation (email, uri, date-time, etc.)
addFormats(ajv)

export interface ValidationError {
  path: string
  message: string
  keyword: string
}

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}

/**
 * Validate request body against a JSON Schema
 */
export function validateRequestBody(
  body: unknown,
  schema: Record<string, unknown>
): ValidationResult {
  try {
    const validate = ajv.compile(schema)
    const valid = validate(body)

    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map((e) => ({
          path: e.instancePath || "/",
          message: e.message || "Validation failed",
          keyword: e.keyword,
        })),
      }
    }

    return { valid: true }
  } catch (error) {
    // Schema compilation error
    return {
      valid: false,
      errors: [
        {
          path: "/",
          message: error instanceof Error ? error.message : "Invalid schema",
          keyword: "schema_error",
        },
      ],
    }
  }
}

/**
 * Validate that a schema is valid JSON Schema
 */
export function isValidJsonSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") {
    return false
  }

  try {
    ajv.compile(schema as Record<string, unknown>)
    return true
  } catch {
    return false
  }
}

/**
 * Generate a simple JSON Schema from an example object
 */
export function generateSchemaFromExample(example: unknown): Record<string, unknown> {
  if (example === null) {
    return { type: "null" }
  }

  if (Array.isArray(example)) {
    return {
      type: "array",
      items: example.length > 0 ? generateSchemaFromExample(example[0]) : {},
    }
  }

  const type = typeof example
  switch (type) {
    case "string":
      return { type: "string" }
    case "number":
      return Number.isInteger(example) ? { type: "integer" } : { type: "number" }
    case "boolean":
      return { type: "boolean" }
    case "object": {
      const properties: Record<string, unknown> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(example as Record<string, unknown>)) {
        properties[key] = generateSchemaFromExample(value)
        required.push(key)
      }

      return {
        type: "object",
        properties,
        required,
      }
    }
    default:
      return {}
  }
}
