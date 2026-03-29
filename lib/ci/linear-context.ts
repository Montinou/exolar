/**
 * Linear ticket context enrichment for CI analysis.
 *
 * When a failing test has a linked_ticket (from reporter's ticketMapping or
 * autoDetectTicket), this module fetches ticket details from Linear to:
 * 1. Get acceptance criteria for better BUG vs TEST_ISSUE classification
 * 2. Check ticket status (suppress bug reports for WIP features)
 * 3. Enrich auto-generated GitHub issues with Linear context
 */

export interface LinearTicketContext {
  id: string
  identifier: string       // e.g., "ENG-123"
  title: string
  description: string | null
  state: string            // e.g., "In Progress", "Done", "Backlog"
  priority: number         // 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
  labels: string[]
  assignee: string | null
  url: string
}

/**
 * Fetch ticket context from Linear API.
 * Uses LINEAR_API_KEY env var for authentication.
 * Returns null if ticket not found or API unavailable.
 */
export async function fetchLinearTicket(ticketId: string): Promise<LinearTicketContext | null> {
  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) return null

  try {
    // Linear GraphQL API
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({
        query: `
          query IssueByIdentifier($id: String!) {
            issueSearch(filter: { identifier: { eq: $id } }, first: 1) {
              nodes {
                id
                identifier
                title
                description
                state { name }
                priority
                labels { nodes { name } }
                assignee { name }
                url
              }
            }
          }
        `,
        variables: { id: ticketId },
      }),
      signal: AbortSignal.timeout(5_000),
    })

    if (!response.ok) return null
    const data = await response.json()
    const issue = data?.data?.issueSearch?.nodes?.[0]
    if (!issue) return null

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      state: issue.state?.name ?? "Unknown",
      priority: issue.priority ?? 4,
      labels: issue.labels?.nodes?.map((l: { name: string }) => l.name) ?? [],
      assignee: issue.assignee?.name ?? null,
      url: issue.url,
    }
  } catch {
    console.error(`[Linear] Failed to fetch ticket ${ticketId}`)
    return null
  }
}

/**
 * Check if a ticket is still in progress (WIP).
 * If WIP, auto-bug-reports should be suppressed.
 */
export function isTicketWIP(ticket: LinearTicketContext): boolean {
  const wipStates = ["in progress", "in review", "started", "unstarted", "backlog"]
  return wipStates.includes(ticket.state.toLowerCase())
}

/**
 * Format Linear context for inclusion in GitHub issue body.
 */
export function formatLinearContext(ticket: LinearTicketContext): string {
  return [
    `### Linear Ticket`,
    `- **[${ticket.identifier}](${ticket.url})**: ${ticket.title}`,
    `- **Status**: ${ticket.state}`,
    `- **Priority**: ${["No priority", "Urgent", "High", "Medium", "Low"][ticket.priority] ?? "Unknown"}`,
    ticket.assignee ? `- **Assignee**: ${ticket.assignee}` : null,
    ticket.labels.length > 0 ? `- **Labels**: ${ticket.labels.join(", ")}` : null,
  ].filter(Boolean).join("\n")
}
