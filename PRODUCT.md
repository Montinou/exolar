# Product

## Register

product

> Note: split-register product. The marketing landing receives equal craft to the
> dashboard; register defaults to `product` because the primary user (Platform/DevEx)
> lives in the dashboard daily. Treat the landing as `brand` register per-task when
> working on it.

## Users

Platform / Developer-Experience teams who own Playwright suites for an engineering organization. They open Exolar before releases (is shipping safe?), during incidents (what's red?), and on demand (which suites are flaky?). They are not the people writing the tests; they are the people accountable for the suite's health across multiple repos, suites, and orgs.

## Product Purpose

Exolar gives Platform/DevEx teams a confident debrief of CI test health. Multi-tenant Playwright analytics with AI-powered failure clustering, flake taxonomies, and smart test selection. The system answers "what happened, what's flaky, what to fix", not just "here are the numbers".

An AI triage reporting layer is on the near-term roadmap. Design must leave room for a first-class triage surface that synthesizes failures into a narrative report (sits alongside the existing AI clustering and semantic search features, not bolted on).

## Brand Personality

Atmospheric maker-tool. Three words: **confident · atmospheric · diagnostic**. Voice is expert-but-readable, never marketing fluff. The dashboard speaks like a senior engineer writing the post-mortem: "here's what failed, here's why, here's the call." References: Linear (marketing + app), Arc, Cron, Vercel's product polish.

## Anti-references

- **Bootstrap-era observability** (old Grafana / Kibana / Splunk): dense charts crammed together, no hierarchy, color soup.
- **AI-slop heroes**: big-number-with-gradient, identical icon-card grids, glassmorphism overlay. The current SaaS template.
- **Crypto / web3 neon**: neon-on-black, holographic gradients, "futuristic" tropes.

## Design Principles

1. **Debrief, not dashboard.** Lead with what happened, not raw metrics. Every screen answers "so what?" before "what?"
2. **Atmospheric where it earns it.** Heroic backgrounds and signature motion live on brand surfaces and in-product moments (empty states, completion screens, the hero of any dashboard). Not on a table view.
3. **Platform-level by default.** Multi-suite, multi-org views are first-class. Single-suite is a drill-down, not the entry.
4. **Expertise as identity.** Show the tool understands testing deeply (clustering, flake taxonomies, calibration windows, smart-selection metrics, soon: AI triage). Generic charts are the AI-slop trap.
5. **Light and dark are equal citizens.** Both modes ship together. Tokens anchor on names, not values.

## Accessibility & Inclusion

- WCAG 2.1 AA minimum: 4.5:1 text contrast, focus indicators, keyboard nav, semantic markup.
- Light + dark mode parity. Both first-class.
- `prefers-reduced-motion` honored on all atmospheric / hero motion. The maker-tool lane needs motion; without this guard, motion breaks accessibility on real devices.
