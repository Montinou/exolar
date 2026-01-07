# MCP Skill: The "Debugger" Path

## Overview
Equips Claude with "eyes" to read the actual content of test artifacts (logs, screenshots, traces). This removes the need for the user to manually copy-paste error logs, allowing Claude to self-serve the context needed to fix bugs.

## Proposed Tools

### 1. `get_artifact_content`

**Purpose:**
Fetches the raw text content of a log file or the metadata/url of a binary file.

**Input Schema:**
```json
{
  "url": "string (The artifact URL returned by get_execution_details)",
  "max_lines": "number (default: 500)"
}
```

**Implementation Logic:**
1.  **Validate URL:** Ensure the URL belongs to the organization's R2 bucket or allowed domains.
2.  **Determine Type:** Check file extension or Content-Type header.
3.  **Fetch Content:**
    *   **Text/Logs:** Download and return the last `max_lines`.
    *   **Images:** Return the signed URL again (or a specialized description if vision is supported).
    *   **Traces:** Return a specific "Use analyze_failure_trace instead" message.
4.  **Security:** Ensure the authenticated user has access to the signed URL.

**Example Usage:**
User: "Why did the login test fail?"
Agent: Calls `get_execution_details` -> sees `auth.log` artifact -> calls `get_artifact_content(url)` -> reads "401 Unauthorized" -> Explains "The API key expired."

### 2. `analyze_failure_trace`

**Purpose:**
extracts meaningful error steps from a Playwright Trace file without downloading the entire 50MB zip.

**Input Schema:**
```json
{
  "trace_url": "string",
  "execution_id": "number"
}
```

**Implementation Logic:**
*Note: This requires a backend service capable of parsing traces, or a "light" parsing logic in the Node.js layer.*
1.  Download the trace zip stream.
2.  Extract `trace.network` or `trace.actions`.
3.  Filter for:
    *   Failed actions (red steps).
    *   Console errors.
    *   Network requests with 4xx/5xx status.
4.  Return a summarized JSON of the "Fatal Steps".

---

## ROI Analysis
*   **Time Saved:** High. Eliminates "Can you paste the log?" roundtrips.
*   **Autonomy:** High. Enables "Fix this build" autonomous loops.
*   **Complexity:** Medium (Trace parsing is non-trivial).
