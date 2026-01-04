# Exolar QA: Rebranding Specification

## 1. Brand Identity Overview

*   **New Brand Name**: **Exolar QA**
*   **Abbreviated/Internal Name**: **Exolar**
*   **Tagline**: *Testing at the Edge of Light* (or similar space-themed variant)
*   **Niche**: E2E Testing Dashboard & Analytics
*   **Core Aesthetic**: "Deep Space", "High-Tech", "Interstellar", "Dark Mode"

### 1.1 Rationale for "Exolar"
*   **Etymology**: Derived from **Exo-** (outer, external, as in Exoplanet) + **Solar** (sun, system). Together it evokes "Outer Solar System" or "Beyond the Solar System".
*   **Phonetics**: Sharp 'X' sound, open 'O' vowels. Sounds modern, technical, and fast.
*   **Uniqueness**: Extensive research confirmed "Exolar" is unique in the software/DevTools space. The only existing conflict is a Solar Energy company, which operates in a completely different industry (Energy/Hardware), minimizing legal and confusion risks.
*   **Semantic Fit**: "Exolar" aligns perfectly with the project's existing "Deep Space" visual theme (Nebulas, Stars, Dark UI).

## 2. Visual Identity Changes

### 2.1 Logo Concepts (To Be Created)
*   **Icon**: Should likely feature an orbital ring, a stylized planet, or a "spark/flare" (solar flare).
*   **Colors**:
    *   **Primary**: Deep Void Black / Midnight Blue (Backgrounds)
    *   **Accents**: Solar Orange, Nebula Purple, Starlight Cyan.
    *   **Gradient**: A shift from "Hot Core" (Orange/Red) to "Cold Space" (Deep Blue/Purple).

### 2.2 Typography
*   **Headings**: Modern geometric sans-serif (e.g., *Inter*, *Outfit*, or *Space Grotesk*).
*   **Monospace**: *JetBrains Mono* or *Fira Code* for all code snippets and CLI outputs.

## 3. Implementation Plan

### Phase 1: Documentation & Art Assets (Current)
- [x] Select Name (Exolar QA)
- [ ] Create/Generate new Logos (`public/branding/logo-full.png`, `logo-icon.png`)
- [ ] Update `branding_research.md` (Finalize)

### Phase 2: Package Renaming (High Impact)
The following packages need to be scoped/renamed:

*   **Reporter Package**:
    *   Old: `@exolar/playwright-reporter` (or `@e2e/reporter`)
    *   **New**: `@exolar/playwright-reporter`
    *   *Action*: Update `packages/playwright-reporter/package.json`.

*   **MCP Server**:
    *   Old: `e2e-mcp-server`
    *   **New**: `@exolar/mcp-server`
    *   *Action*: Update `packages/mcp-server/package.json`.

### Phase 3: Codebase Refactoring
*   **Global Find/Replace**:
    *   `"E2E Test Dashboard"` -> `"Exolar QA"`
    *   Old branding -> `"Exolar"` (where applicable in titles/headers).
*   **UI Components**:
    *   Update Header/Nav with new Name/Logo.
    *   Update Landing Page Hero text ("Welcome to Exolar").
    *   Update Meta Tags (Title, Description) in `layout.tsx`.

### Phase 4: Domain & Deployment
*   **Domain**: Search for `exolar.dev`, `exolar.io`, `exolar.qa`.
*   **Vercel Project**: Rename project to `exolar-dashboard`.

## 4. MCP & AI Integration
The rebranding reinforces the "Agentic" nature of the tool.
*   **Agent Name**: The AI assistant within the dashboard can be referred to as **"Exolar Agent"** or **"Exo"**.
*   **Skills**: "Exolar Debugger", "Exolar Analyst".

## 5. Next Steps
1.  **Approve this Spec**: Confirm this roadmap.
2.  **Asset Generation**: Generate the new logo files.
3.  **Refactor**: Begin the string replacement and package renaming.
