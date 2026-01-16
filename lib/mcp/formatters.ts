/**
 * MCP Output Formatters
 *
 * Converts data to different output formats optimized for:
 * - JSON: Structured data for programmatic use
 * - Markdown: CLI-friendly, token-efficient tables
 * - CSV: Minimal tokens, easy to parse
 *
 * Token savings: Markdown/CSV use ~70% fewer tokens than JSON for tabular data.
 */

export type OutputFormat = "json" | "markdown" | "csv"

/**
 * Format an array of objects as a table
 */
export function formatTable<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string; formatter?: (v: unknown) => string }[],
  format: OutputFormat = "markdown"
): string {
  if (data.length === 0) {
    return format === "json" ? "[]" : "No data"
  }

  switch (format) {
    case "json":
      // Only include specified columns
      const filtered = data.map((row) => {
        const obj: Record<string, unknown> = {}
        for (const col of columns) {
          obj[String(col.key)] = row[col.key]
        }
        return obj
      })
      return JSON.stringify(filtered, null, 2)

    case "csv": {
      const header = columns.map((c) => c.label).join(",")
      const rows = data.map((row) =>
        columns
          .map((col) => {
            const val = col.formatter ? col.formatter(row[col.key]) : String(row[col.key] ?? "")
            // Escape CSV values that contain commas or quotes
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`
            }
            return val
          })
          .join(",")
      )
      return [header, ...rows].join("\n")
    }

    case "markdown":
    default: {
      // Calculate column widths for alignment
      const widths = columns.map((col) => {
        const headerLen = col.label.length
        const maxDataLen = Math.max(
          ...data.map((row) => {
            const val = col.formatter ? col.formatter(row[col.key]) : String(row[col.key] ?? "")
            return val.length
          })
        )
        return Math.max(headerLen, maxDataLen, 3) // Minimum 3 chars
      })

      // Header row
      const header = "| " + columns.map((col, i) => col.label.padEnd(widths[i])).join(" | ") + " |"

      // Separator row
      const separator = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |"

      // Data rows
      const rows = data.map((row) => {
        const cells = columns.map((col, i) => {
          const val = col.formatter ? col.formatter(row[col.key]) : String(row[col.key] ?? "")
          return val.padEnd(widths[i])
        })
        return "| " + cells.join(" | ") + " |"
      })

      return [header, separator, ...rows].join("\n")
    }
  }
}

/**
 * Format a single metric value with proper unit display
 */
export function formatMetricValue(
  value: number | string | null | undefined,
  type: "percentage" | "count" | "duration" | "score" | "rate",
  format: OutputFormat = "markdown"
): string {
  if (value === null || value === undefined) {
    return format === "json" ? "null" : "N/A"
  }

  // Convert to number (PostgreSQL numeric types often returned as strings)
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) {
    return format === "json" ? "null" : "N/A"
  }

  switch (type) {
    case "percentage":
      return format === "json" ? String(num) : `${num.toFixed(1)}%`
    case "duration":
      if (num >= 60000) {
        return format === "json" ? String(num) : `${(num / 60000).toFixed(1)}m`
      } else if (num >= 1000) {
        return format === "json" ? String(num) : `${(num / 1000).toFixed(1)}s`
      }
      return format === "json" ? String(num) : `${Math.round(num)}ms`
    case "count":
      return format === "json" ? String(num) : num.toLocaleString()
    case "score":
      return format === "json" ? String(num) : `${Math.round(num)}/100`
    case "rate":
      return format === "json" ? String(num) : num.toFixed(2)
    default:
      return String(num)
  }
}

/**
 * Format a comparison between two values
 */
export function formatComparison(
  current: number | string,
  previous: number | string,
  type: "percentage" | "count" | "duration" | "score" = "percentage",
  format: OutputFormat = "markdown"
): string {
  // Convert to numbers (PostgreSQL numeric types often returned as strings)
  const currentNum = typeof current === "string" ? parseFloat(current) : current
  const previousNum = typeof previous === "string" ? parseFloat(previous) : previous

  const delta = currentNum - previousNum
  const deltaPercent = previousNum !== 0 ? ((currentNum - previousNum) / previousNum) * 100 : 0
  const trend = delta > 0 ? "increasing" : delta < 0 ? "decreasing" : "stable"
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→"

  if (format === "json") {
    return JSON.stringify({
      current: currentNum,
      previous: previousNum,
      delta,
      delta_percent: deltaPercent,
      trend,
    })
  }

  const currentStr = formatMetricValue(currentNum, type, format)
  const deltaStr =
    type === "percentage"
      ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pp`
      : `${delta >= 0 ? "+" : ""}${formatMetricValue(delta, type, format)}`

  if (format === "csv") {
    return `${currentStr},${deltaStr},${trend}`
  }

  return `${currentStr} (${arrow} ${deltaStr})`
}

/**
 * Format a time series as a compact markdown table
 */
export function formatTimeSeries(
  data: Array<{ period: string; value: number | string; delta?: number | string }>,
  metricName: string,
  type: "percentage" | "count" | "duration" | "score" = "percentage",
  format: OutputFormat = "markdown"
): string {
  // Helper to convert to number (PostgreSQL numeric types often returned as strings)
  const toNum = (v: number | string | undefined): number => {
    if (v === undefined) return 0
    return typeof v === "string" ? parseFloat(v) : v
  }

  if (format === "json") {
    return JSON.stringify(data, null, 2)
  }

  if (format === "csv") {
    const header = "period,value,delta"
    const rows = data.map((d) => {
      const deltaNum = toNum(d.delta)
      return `${d.period},${formatMetricValue(d.value, type, "json")},${d.delta !== undefined ? (deltaNum >= 0 ? "+" : "") + deltaNum.toFixed(1) : ""}`
    })
    return [header, ...rows].join("\n")
  }

  // Markdown format
  let output = `## ${metricName}\n\n`

  output += formatTable(
    data,
    [
      { key: "period", label: "Period" },
      { key: "value", label: "Value", formatter: (v) => formatMetricValue(v as number | string, type, "markdown") },
      {
        key: "delta",
        label: "Delta",
        formatter: (v) => {
          if (v === undefined || v === null) return "--"
          const num = toNum(v as number | string)
          return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`
        },
      },
    ],
    "markdown"
  )

  // Add summary if we have enough data
  if (data.length > 0) {
    const latest = data[0]
    const oldest = data[data.length - 1]
    const latestValue = toNum(latest.value)
    const oldestValue = toNum(oldest.value)
    const totalChange = latestValue - oldestValue
    output += `\n\n**Summary:** ${formatMetricValue(latest.value, type, "markdown")} current`
    if (totalChange !== 0) {
      output += `, ${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(1)}${type === "percentage" ? "pp" : ""} vs baseline`
    }
  }

  return output
}

/**
 * Format execution list for display
 */
export function formatExecutions(
  executions: Array<{
    id: number
    branch: string
    status: string
    passed_count?: number
    failed_count?: number
    duration_ms?: number
    started_at: string
  }>,
  format: OutputFormat = "markdown"
): string {
  return formatTable(
    executions,
    [
      { key: "id", label: "ID" },
      { key: "branch", label: "Branch" },
      { key: "status", label: "Status" },
      {
        key: "passed_count",
        label: "Passed",
        formatter: (v) => String(v ?? 0),
      },
      {
        key: "failed_count",
        label: "Failed",
        formatter: (v) => String(v ?? 0),
      },
      {
        key: "duration_ms",
        label: "Duration",
        formatter: (v) => formatMetricValue(v as number, "duration", format),
      },
      {
        key: "started_at",
        label: "Started",
        formatter: (v) => {
          if (!v) return "N/A"
          const d = new Date(v as string)
          return format === "json" ? (v as string) : d.toLocaleDateString()
        },
      },
    ],
    format
  )
}

/**
 * Format flaky tests list
 */
export function formatFlakyTests(
  tests: Array<{
    test_name: string
    test_file: string
    flakiness_rate: number
    total_runs: number
    flaky_runs: number
  }>,
  format: OutputFormat = "markdown"
): string {
  return formatTable(
    tests,
    [
      {
        key: "test_name",
        label: "Test",
        formatter: (v) => {
          const name = String(v)
          return name.length > 40 ? name.substring(0, 37) + "..." : name
        },
      },
      {
        key: "flakiness_rate",
        label: "Flaky %",
        formatter: (v) => formatMetricValue(v as number, "percentage", format),
      },
      { key: "flaky_runs", label: "Flaky" },
      { key: "total_runs", label: "Total" },
    ],
    format
  )
}

/**
 * Format branches list
 */
export function formatBranches(
  branches: Array<{
    branch: string
    execution_count: number
    pass_rate: number
    last_status: string
  }>,
  format: OutputFormat = "markdown"
): string {
  return formatTable(
    branches,
    [
      { key: "branch", label: "Branch" },
      { key: "execution_count", label: "Runs" },
      {
        key: "pass_rate",
        label: "Pass Rate",
        formatter: (v) => formatMetricValue(v as number, "percentage", format),
      },
      { key: "last_status", label: "Last" },
    ],
    format
  )
}

/**
 * Wrap response with standard MCP format
 */
export function wrapResponse(
  data: string,
  metadata: { organization?: string; count?: number; format: OutputFormat }
): string {
  if (metadata.format === "json") {
    // For JSON, parse and add metadata
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(
        {
          organization: metadata.organization,
          count: metadata.count,
          data: parsed,
        },
        null,
        2
      )
    } catch {
      return data
    }
  }

  // For markdown/csv, add header comment
  let header = ""
  if (metadata.organization) {
    header += `<!-- org: ${metadata.organization} -->\n`
  }
  if (metadata.count !== undefined) {
    header += `<!-- count: ${metadata.count} -->\n`
  }

  return header ? header + "\n" + data : data
}
