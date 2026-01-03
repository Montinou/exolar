# MCP Skill: The "Workflow" Path

## Overview
Integrates the Dashboard with external project management and communication tools. This transforms the Dashboard from a passive reporter into an active participant in the team's triage workflow.

## Proposed Tools

### 1. `create_issue_from_failure`

**Purpose:**
Creates a Linear or Jira ticket populated with failure details.

**Input Schema:**
```json
{
  "execution_id": "number",
  "test_name": "string (Optional, specific test)",
  "title": "string (Optional override)",
  "description": "string (Optional additional context)",
  "assignee_email": "string (Optional)"
}
```

**Implementation Logic:**
1.  **Fetch Context:** Pull test failure details, branch name, and recent error history using `get_execution_details`.
2.  **Format Description:** Generate a markdown body including:
    *   Stack trace.
    *   Link to Dashboard execution.
    *   Flakiness history.
3.  **External API Call:**
    *   Use Linear/Jira API (requires API key in Organization Settings).
    *   Create Issue.
4.  **Link Back:** Store the external Issue ID in the Dashboard database (requires schema migration to add `external_issue_id` to `test_results` or similar).

**Example Usage:**
User: "File a ticket for this flake."
Agent: Calls `create_issue_from_failure` -> Creates Linear issue "Flaky Test: Navigation Flow" -> Returns "Ticket LIN-123 created."

### 2. `assign_failure`

**Purpose:**
Assigns a specific failure investigation to a team member within the Dashboard's own system.

**Input Schema:**
```json
{
  "execution_id": "number",
  "user_email": "string"
}
```

**Implementation Logic:**
1.  **Validate User:** Ensure `user_email` is a valid member of the Organization.
2.  **Update DB:** Set the `assigned_to` field on the Execution or TestResult record.
3.  **Notify:** Trigger an email (via Resend/Postmark) or Slack notification: "You have been assigned to investigate [Execution #123]."

---

## ROI Analysis
*   **Time Saved:** Medium. Faster than manual copy-paste ticket creation.
*   **Collaboration:** High. Enforces ownership of broken builds.
*   **Complexity:** High (Requires external API auth management and new DB table columns).
