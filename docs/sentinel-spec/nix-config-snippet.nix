# ┌──────────────────────────────────────────────────────────────────┐
# │  exolar-sentinel — Nix config snippet for montino.nix           │
# │                                                                   │
# │  PURPOSE: Reference snippet to copy-paste into the appropriate   │
# │  sections of ~/.openclaw-nix/hosts/montino.nix                  │
# │                                                                   │
# │  DO NOT apply this file directly — it is not a complete module.  │
# │  Each section below is labeled with its insertion point.         │
# └──────────────────────────────────────────────────────────────────┘


# ═══════════════════════════════════════════════════════════════════
# SECTION 1: agents.list entry
#
# Insert inside the `agents.list = [ ... ]` block in montino.nix,
# after the existing sentinel entry for argus.
#
# Archetype: sentinel (webhook-triggered, no Telegram bot)
# Model: sonnet-4.6 — cost-effective for structured analysis workloads.
# Workspace: dedicated directory under ~/.openclaw/workspaces/
# ═══════════════════════════════════════════════════════════════════

          # ── Exolar Sentinel (CI failure analysis + auto-heal) ──────
          # Triggered exclusively via webhook POST /exolar/ci-failure.
          # No Telegram bot — this agent is not interactive.
          # Model override: sonnet-4.6 (explicit, same as default but
          #   stated for clarity; escalate to opus-4.6 is handled at
          #   runtime by the agent itself per SOUL.md guardrails).
          {
            id        = "exolar-sentinel";
            name      = "Exolar Sentinel";
            model     = "anthropic/claude-sonnet-4-6";
            workspace = "${wsd}/exolar-sentinel";
          }


# ═══════════════════════════════════════════════════════════════════
# SECTION 2: webhooks top-level config
#
# OpenClaw webhook triggers live in the top-level config object,
# not inside the agents block. Insert this as a new top-level key
# inside `programs.openclaw.config = { ... }` in montino.nix.
#
# The `target` field routes the incoming webhook payload to the
# named agent as a new session message containing the raw JSON body.
# ═══════════════════════════════════════════════════════════════════

      webhooks = {
        # CI failure webhook — fired by Exolar platform after each
        # Playwright test run that contains at least one failure.
        # Payload shape: { execution_id, org_id, run_id, repo,
        #                  branch, failure_count }
        "exolar-ci-failure" = {
          path   = "/exolar/ci-failure";   # POST endpoint path
          target = "exolar-sentinel";       # routes to this agent ID
        };
      };


# ═══════════════════════════════════════════════════════════════════
# SECTION 3: tools.agentToAgent allow-list addition
#
# Add "exolar-sentinel" to the existing agentToAgent.allow list
# so the agent can send and receive native a2a messages from
# Prometeo (infra escalations) and Morfeo (fleet-level reports).
#
# Original list is at tools.agentToAgent.allow in montino.nix.
# Add "exolar-sentinel" to that list — shown here in context:
# ═══════════════════════════════════════════════════════════════════

        agentToAgent = {
          enabled = true;
          allow   = [
            "ads"           "echo"        "multimedia"    "portfolio"
            "interviews"    "sales"       "jardin"        "alejandria"
            "curator"       "curator-aws" "argus"         "musa"
            "main"          "life"        # AWS agents (cross-instance)
            "deployer"      # Quotation-agent verticals
            "prometeo"      # Infrastructure ops (shadow orchestrator)
            "exolar-sentinel"             # CI failure analysis + auto-heal
          ];
        };


# ═══════════════════════════════════════════════════════════════════
# SECTION 4: workspace bootstrap (NOT Nix — manual step)
#
# The following files must be created in the workspace directory
# AFTER running `home-manager switch`. They are not managed by Nix.
#
# Directory: ~/.openclaw/workspaces/exolar-sentinel/
#
# Required bootstrap files (copy from docs/sentinel-spec/):
#   IDENTITY.md  →  ~/.openclaw/workspaces/exolar-sentinel/IDENTITY.md
#   SOUL.md      →  ~/.openclaw/workspaces/exolar-sentinel/SOUL.md
#   TOOLS.md     →  ~/.openclaw/workspaces/exolar-sentinel/TOOLS.md
#
# The system prompt for the agent is assembled from these files
# at bootstrap time. IDENTITY.md defines the agent's role and
# workflow. SOUL.md defines guardrails and escalation policy.
# TOOLS.md documents MCP tool usage.
# ═══════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════
# SECTION 5: mcporter.json (NOT Nix — manual step)
#
# MCP server connections are configured per-workspace in a file
# named `config/mcporter.json` inside the agent's workspace.
# This is NOT a Nix-managed file — create it manually.
#
# Path: ~/.openclaw/workspaces/exolar-sentinel/config/mcporter.json
#
# The JSON below uses environment-variable substitution syntax
# supported by the mcporter runtime. Set the corresponding env
# vars in the systemd service override file:
#   ~/.config/systemd/user/openclaw-gateway.service.d/override.conf
#
# Required env vars (add to systemd override):
#   EXOLAR_MCP_TOKEN   — Exolar QA MCP bearer token
#   QUOTH_MCP_TOKEN    — Quoth pattern MCP bearer token
#   LINEAR_API_KEY     — Linear workspace API key
#
# JSON content to write to the file:
# ═══════════════════════════════════════════════════════════════════

# {
#   "mcpServers": {
#
#     "exolar-qa": {
#       "type": "http",
#       "url": "https://exolar.triqual.dev/api/mcp/mcp",
#       "headers": {
#         "Authorization": "Bearer ${EXOLAR_MCP_TOKEN}"
#       }
#     },
#
#     "quoth": {
#       "type": "http",
#       "url": "https://quoth.triqual.dev/api/mcp",
#       "headers": {
#         "Authorization": "Bearer ${QUOTH_MCP_TOKEN}"
#       }
#     },
#
#     "linear": {
#       "type": "sse",
#       "url": "https://mcp.linear.app/sse",
#       "headers": {
#         "Authorization": "Bearer ${LINEAR_API_KEY}"
#       }
#     }
#
#   }
# }


# ═══════════════════════════════════════════════════════════════════
# SECTION 6: memory namespace (NOT Nix — workspace config)
#
# The memory-lancedb plugin (enabled globally in montino.nix) uses
# per-agent namespaces derived from the workspace path by default.
# To pin an explicit namespace for exolar-sentinel, create or edit
# the agent config file at:
#
#   ~/.openclaw/workspaces/exolar-sentinel/config/agent.json
#
# Content:
# {
#   "memory": {
#     "namespace": "exolar-sentinel"
#   }
# }
#
# This ensures all LanceDB vectors for this agent are isolated under
# the "exolar-sentinel" namespace and won't bleed into other agents'
# recall when the lancedb plugin does cross-session retrieval.
# ═══════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════
# SECTION 7: builtin tools (informational — no config change needed)
#
# The git, github, and web tools are already enabled globally via
# the `tools` block in montino.nix:
#
#   tools.exec.safeBins includes "git"
#   tools.web.fetch.enabled = true (web)
#   github is available via the bundled `sag` plugin (enable = true)
#
# No additional Nix config is required for these tools.
# The TOOLS.md workspace file documents usage constraints for the
# agent (branch naming policy, PR-only merges, etc.).
# ═══════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════
# DEPLOYMENT CHECKLIST
#
# 1. Add the agents.list entry (Section 1) to montino.nix
# 2. Add the webhooks block (Section 2) to montino.nix
# 3. Add "exolar-sentinel" to tools.agentToAgent.allow (Section 3)
# 4. Run: cd ~/.openclaw-nix && nix run .#homeConfigurations.lord_montino.activationPackage
# 5. mkdir -p ~/.openclaw/workspaces/exolar-sentinel/config
# 6. Copy IDENTITY.md, SOUL.md, TOOLS.md into the workspace
# 7. Write config/mcporter.json (Section 5) with real tokens
# 8. Write config/agent.json (Section 6) for memory namespace
# 9. Add EXOLAR_MCP_TOKEN, QUOTH_MCP_TOKEN, LINEAR_API_KEY to the
#    systemd service override file and reload:
#    systemctl --user restart openclaw-gateway
# 10. Verify: openclaw status && openclaw agent list
# ═══════════════════════════════════════════════════════════════════
