# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Exolar QA** is a multi-tenant dashboard for monitoring Playwright test executions. It provides real-time test analytics, flakiness detection, failure analysis, and integrates with Claude Code via MCP (Model Context Protocol).

**Product Name:** Exolar QA (formerly E2E Test Dashboard)

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

Add new shadcn components via:
```bash
npx shadcn@latest add <component-name>
```

## Architecture

### Stack
- **Framework**: Next.js 16 with App Router and React Server Components
- **Database**: Neon PostgreSQL (serverless) via `@neondatabase/serverless`
- **Storage**: Cloudflare R2 for test artifacts (videos, traces, screenshots)
- **UI**: shadcn/ui (new-york style) with TailwindCSS v4
- **Charts**: Recharts
- **Auth**: Neon Auth (`@neondatabase/auth`)
- **MCP**: Built-in MCP server for Claude Code integration

### Key Directories
```
app/                         # Next.js App Router
├── api/                     # API endpoints
│   ├── executions/          # Execution CRUD
│   ├── metrics/             # Dashboard metrics
│   ├── trends/              # Time-series data
│   ├── flakiness/           # Flaky test detection
│   ├── artifacts/           # R2 signed URLs
│   ├── organizations/       # Org management
│   ├── admin/               # Admin endpoints
│   ├── mcp/                 # MCP server endpoint (HTTP Streamable)
│   └── reliability-score/   # Test reliability calculations
├── admin/                   # Admin pages (users, invites, organizations)
├── dashboard/               # Dashboard pages (performance, reliability)
└── settings/                # Settings pages (MCP config)

components/
├── dashboard/               # Dashboard-specific components
│   ├── charts/              # Chart components (trends, heatmaps)
│   └── ...                  # Cards, tables, metrics
├── ui/                      # shadcn/ui components
└── shared/                  # Shared components

lib/                         # Core utilities
├── db.ts                    # Database queries with org filtering
├── db-orgs.ts               # Organization management
├── db-users.ts              # User management with org assignment
├── session-context.ts       # Session and auth context
├── api-keys.ts              # API key management
├── r2.ts                    # R2 integration for artifacts
├── types.ts                 # TypeScript types
├── colors.ts                # Theme color utilities
├── validation.ts            # Input validation
├── mcp/                     # MCP server implementation
│   ├── index.ts             # Exports and router
│   ├── auth.ts              # JWT validation (Neon Auth + MCP tokens)
│   ├── tools.ts             # 5 consolidated tool definitions
│   ├── definitions.ts       # Metric semantic layer (prevents hallucinations)
│   ├── formatters.ts        # Output formatters (JSON/Markdown/CSV)
│   ├── analytics.ts         # Shared business logic
│   └── handlers/            # Tool handlers
│       ├── explore.ts       # Discovery (datasets, branches, suites)
│       ├── query.ts         # Universal data router (14 datasets)
│       ├── action.ts        # Heavy operations (compare, report, classify)
│       └── definition.ts    # Metric definition lookup
└── auth/                    # Auth utilities

scripts/                     # SQL migration scripts for Neon
packages/                    # Monorepo packages
└── mcp-server/              # @exolar-qa/mcp-server package

docs/                        # Documentation
├── MULTITENANCY_COMPLETED.md
├── MCP_INTEGRATION.md
├── MODERN_DASHBOARD_FEATURES.md
└── dashboard-integration/   # Integration guides
```

### Database Schema

**Core Tables:**
- `test_executions` - Workflow runs (with `organization_id`)
- `test_results` - Individual tests (linked via `execution_id`)
- `test_artifacts` - R2 file references
- `test_flakiness_history` - Flaky test tracking (with `organization_id`)

**Multi-Tenancy Tables:**
- `organizations` - Org definitions (id, name, slug)
- `organization_members` - User-org membership (with role: owner/admin/viewer)
- `dashboard_users` - Users (with `default_org_id`)
- `invites` - Pending invites (with `org_id`)

See `scripts/009_add_organizations.sql` for full schema.

### Data Flow
1. GitHub Actions runs Playwright tests and inserts results into Neon
2. Dashboard fetches via Server Components calling `lib/db.ts` functions
3. Artifacts are accessed via signed R2 URLs generated in `lib/r2.ts`
4. Claude Code accesses data via MCP endpoint at `/api/mcp`

## Environment Variables

### Required
- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEON_AUTH_JWKS_URL` - Neon Auth JWKS endpoint (for MCP auth)

### Optional (for artifact downloads)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

## Code Patterns

### Database Access
All queries use organization filtering via `getQueriesForOrg()`:

```typescript
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

// In API route or Server Component:
const context = await getSessionContext()
if (!context) return unauthorized()

const db = getQueriesForOrg(context.organizationId)
const executions = await db.getExecutions()  // Auto-filtered by org
```

For CI/CD ingestion (API key auth), use service account context:
```typescript
import { setServiceAccountContext, getQueriesForOrg } from "@/lib/db"

await setServiceAccountContext()  // Bypass RLS
const db = getQueriesForOrg(orgId)
await db.insertExecution(execution)
```

### API Routes
Use `export const dynamic = "force-dynamic"` in API routes to ensure fresh data on each request.

### Path Aliases
Use `@/` prefix for imports (configured in tsconfig.json).

### Server Components
The main page (`app/page.tsx`) uses React Server Components with `Suspense` for loading states. Data fetching happens server-side with `Promise.all` for parallel queries.

## Development Rules

### Code Quality
- ALWAYS prefer editing existing files over creating new ones
- Avoid over-engineering - only make changes directly requested or clearly necessary
- Don't add features, refactor code, or make "improvements" beyond what was asked
- Keep solutions simple and focused
- Don't add docstrings, comments, or type annotations to code you didn't change

### React Best Practices

**Avoid infinite loops with proper cleanup:**
```typescript
// ✅ GOOD - With cleanup
useEffect(() => {
  const subscription = someService.subscribe((event) => {
    // handle event
  });

  return () => subscription.unsubscribe(); // Cleanup crucial
}, []);

// ❌ BAD - No cleanup, can cause infinite re-renders
useEffect(() => {
  someService.subscribe((event) => {
    // handle event
  });
}, []);
```

**Stabilize object references to prevent re-renders:**
```typescript
// ❌ BAD - Objects as dependencies
const config = { limit: 10 }; // Recreated every render
useEffect(() => {
  fetchData(config);
}, [config]); // Loop!

// ✅ GOOD - useMemo for stable references
const config = useMemo(() => ({ limit: 10 }), []);
useEffect(() => {
  fetchData(config);
}, [config]);

// ✅ BETTER - Primitive values as dependencies
const limit = 10;
useEffect(() => {
  fetchData({ limit });
}, [limit]);
```

**Never use patterns like:**
```typescript
// ❌ BAD - Never do this
if (true === true) { ... }
```

### UI Components
- Follow the shadcn design system
- Manage colors via CSS variables for theming consistency
- Use `npx shadcn@latest add <component-name>` to add components
- Prefer existing components over creating new ones

### Git Workflow
- Only commit when explicitly requested
- Use conventional commit format: `<type>(<scope>): <description>`
- Never use `--force` flags or destructive commands without explicit request
- Include co-authorship in commits:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  ```

### Error Handling
- Keep error messages short and actionable: `❌ {What failed}: {Exact solution}`
- Fail fast - check critical prerequisites, then proceed
- Don't over-validate things that rarely fail
- Trust the system - don't try to prevent every possible edge case

### Path Standards
- Use relative paths in documentation (`lib/db.ts` not absolute paths)
- Never include usernames or local directory structures in committed files
- Use `@/` prefix for imports in code

### DateTime Handling
When timestamps are needed, always get real system time:
```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```
Never use placeholder values.

### Do Not
- Add hardcoded timeouts
- Run `yarn check:types` unless explicitly asked
- Run format commands unless explicitly asked
- Assume things without verifying - confirm instead

## Parent Project Rules

This project inherits rules from the parent Attorneyshare repository located in `../.claude/rules/`. These rules provide standardized patterns for common operations.

### GitHub Operations (`../.claude/rules/github-operations.md`)

**Critical Repository Protection:**
Before ANY GitHub operation that creates/modifies issues or PRs, ALWAYS check remote origin:

```bash
remote_url=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$remote_url" == *"template-repo"* ]]; then
  echo "❌ ERROR: Wrong repository!"
  exit 1
fi
```

**Key Principles:**
- Don't pre-check authentication - trust `gh` CLI and handle failures
- Use `--json` for structured output when parsing
- Always specify `--repo` to avoid defaulting to wrong repository
- Error format: `❌ GitHub operation failed: Run: gh auth login`

### AST-Grep Integration (`../.claude/rules/use-ast-grep.md`)

Use `ast-grep` for structural code analysis instead of regex when available:

**When to Use:**
- Finding function calls, class definitions, method implementations
- Language-aware refactoring (renaming, updating signatures)
- Complex code analysis (finding usage patterns)
- Semantic code understanding (structure-based, not text-based)

**Pattern Syntax:**
- `$VAR` - matches any single node and captures it
- `$$$` - matches zero or more nodes (wildcard)
- `$$` - matches one or more nodes
- Literal code - matches exactly as written

**Examples:**
```bash
# Find React hooks
ast-grep --pattern 'const [$STATE, $SETTER] = useState($$$)' --lang tsx .

# Find function calls
ast-grep --pattern 'functionName($$$)' --lang ts .

# Find imports
ast-grep --pattern 'import { $$$ } from "$MODULE"' --lang ts .

# Find class definitions
ast-grep --pattern 'class $NAME { $$$ }' --lang ts .
```

**Supported Languages:** TypeScript, JavaScript, TSX, Python, Go, Rust, Ruby, Java, C, C++, PHP, and 15+ others

### Test Execution (`../.claude/rules/test-execution.md`)

**Core Principles:**
1. Always use test-runner agent from `.claude/agents/test-runner.md`
2. No mocking - use real services for accurate results
3. Verbose output - capture everything for debugging
4. Check test structure first - before assuming code bugs

**Cleanup:**
Always clean up after tests:
```bash
pkill -f "jest|mocha|pytest|phpunit|rspec|ctest" 2>/dev/null || true
pkill -f "mvn.*test|gradle.*test|gradlew.*test" 2>/dev/null || true
```

### Path Standards (`../.claude/rules/path-standards.md`)

Extended path usage guidelines for privacy and portability:

**Core Principles:**
1. **Privacy Protection** - Never include absolute paths with usernames
2. **Portability** - Use relative paths that work across environments
3. **Cross-Project** - Use `../project-name/` for sibling directories

**Path Formats:**
```markdown
# Correct ✅
- lib/db.ts
- ../project-name/internal/auth/server.go
- [filename.ts:42](src/filename.ts#L42)  # Clickable references

# Incorrect ❌
- /Users/username/project/lib/db.ts
- C:\Users\username\project\lib\db.ts
```

### Standard Patterns (`../.claude/rules/standard-patterns.md`)

Core principles for all operations:

**Fail Fast:**
- Check critical prerequisites only
- Don't over-validate things that rarely fail
- Trust the system (file system works, GitHub CLI authenticated)

**Clear Errors:**
- Format: `❌ {What failed}: {Exact solution}`
- Example: `❌ Epic not found: Run /pm:prd-parse feature-name`

**Minimal Output:**
- Use ✅/❌/⚠️ sparingly
- Show results, not decoration
- Focus on what matters

**Smart Defaults:**
- Only ask when destructive or ambiguous
- Proceed with sensible defaults
- Don't ask permission for safe operations

### Other Available Rules

Additional rules available but less relevant for this project:
- `worktree-operations.md` - Git worktree management for parallel development
- `branch-operations.md` - Git branch operations and best practices
- `agent-coordination.md` - Multi-agent coordination patterns
- `frontmatter-operations.md` - YAML frontmatter in markdown files
- `strip-frontmatter.md` - Removing frontmatter before GitHub sync


## Testing

This project monitors Playwright test results but doesn't have its own test suite yet. When adding tests:
- Use Vitest for unit/integration tests (NOT Jest)
- Use `vi.fn()`, `vi.mock()`, `vi.clearAllMocks()`
- Follow the test-runner agent pattern for execution
- Capture verbose output for debugging

## Security Considerations

- Never commit secrets or credentials
- Use environment variables for all sensitive configuration
- Validate external input at API boundaries
- Generate signed URLs for R2 artifact access (short expiration times)
- All data queries are org-filtered via `getQueriesForOrg()`
- RLS policies provide database-level protection
- Use `requireOrgAdmin()` or `requireSystemAdmin()` for admin operations
- JWT tokens are verified using Neon Auth's JWKS

## Multi-Tenancy

The dashboard supports multi-tenant data isolation:

- **Organization-based filtering**: All queries filter by `organization_id`
- **Session context**: `getSessionContext()` provides user + org info
- **RLS protection**: Database-level policies prevent cross-org access
- **Admin management**: `/admin/organizations` for org CRUD
- **First-login assignment**: New users are assigned to default org

**Security Layers:**
1. **Application Level**: `getQueriesForOrg(orgId)` adds WHERE clauses
2. **Database Level**: RLS policies verify organization membership

See `docs/MULTITENANCY_COMPLETED.md` for full implementation details.

## MCP Integration

The dashboard exposes a MCP server for Claude Code integration at `/api/mcp/mcp`.

### Quick Start (OAuth - Recommended)

```bash
# Add the MCP server (one-time setup)
claude mcp add --transport http exolar-qa https://exolar.ai-innovation.site/api/mcp/mcp
```

When prompted to **Authenticate**, your browser opens → log in → done! No token copying needed.

### Alternative: Manual Token

If OAuth isn't working, get a token from `/settings/mcp` and use:

```bash
claude mcp add --transport http exolar-qa https://exolar.ai-innovation.site/api/mcp/mcp \
  --header "Authorization: Bearer <token>"
```

### Transport Options

| Transport | URL | Auth | Use Case |
|-----------|-----|------|----------|
| HTTP Streamable (recommended) | `/api/mcp/mcp` | OAuth or Bearer token | Claude Code |
| SSE (legacy) | `/api/mcp/sse?token=xxx` | Query param | Older clients |

### Architecture: Router Pattern
The MCP server uses a consolidated router pattern with **5 tools** (reduced from 24):

| Tool | Purpose | Replaces |
|------|---------|----------|
| `explore_exolar_index` | Discovery (datasets, branches, suites, metrics) | 3 tools |
| `query_exolar_data` | Universal data retrieval with 14 datasets | 15 tools |
| `perform_exolar_action` | Heavy operations (compare, report, classify) | 3 tools |
| `get_semantic_definition` | Metric definitions (prevents hallucinations) | New |
| `get_installation_config` | CI/CD setup guide | Unchanged |

**Token Savings**: ~83% reduction in tool definition overhead (~3,000 → ~500 tokens)

### Available Datasets (via query_exolar_data)
1. **executions** - List test executions
2. **execution_details** - Execution + results
3. **failures** - Failed tests with AI context
4. **flaky_tests** - Flaky test list
5. **trends** - Time-series data
6. **dashboard_stats** - Overall metrics
7. **error_analysis** - Error type breakdown
8. **test_search** - Search by name/file
9. **test_history** - Test run history
10. **flakiness_summary** - Overall flakiness
11. **reliability_score** - Suite health (0-100)
12. **performance_regressions** - Tests slower than baseline
13. **execution_summary** - Execution overview
14. **execution_failures** - Failures for execution

**Router Pattern**: Use `query_exolar_data({ dataset: "executions" })` instead of `get_executions()`. All old tools are mapped to the new 5-tool structure.

See `docs/unorganized-docs/MCP_INTEGRATION.md` for full documentation.

## Key Features

### Implemented
- **Reliability Score** (`/dashboard/reliability`) - Single 0-100 gauge showing test suite health
- **Performance Regression Detection** (`/dashboard/performance`) - Automatic alerts when tests slow down
- **Comparative Run Analysis** (`/dashboard/compare`) - Side-by-side comparison of test executions
- Pass/Fail/Flaky rate metrics with trends
- Stats cards (pass rate, failure rate, avg duration, critical failures)
- Status donut chart, trend area chart, failure rate chart
- Error distribution bar chart
- Flakiest tests card (top 5)
- Slowest tests card
- Suite pass rates
- Branch accordion view
- Test search with history modal
- Test result cards with artifacts (video, trace, screenshots)
- AI context for failures
- Multi-tenancy with organization filtering
- API key management
- **Smart Filter Behavior** - When branch/suite selected: shows last run only by default; "Historic Summary" checkbox shows all runs for filter
- **Chart Data Consistency** - Donut shows only passed/failed/skipped; flaky displayed as separate badge below chart

### Roadmap
See `docs/MODERN_DASHBOARD_FEATURES.md` for planned features including:
- AI Root Cause Analysis
- Intelligent Failure Clustering
- Slack/Teams Notifications
- Auto-Quarantine Flaky Tests

## Prompt Engineering

This project uses structured XML prompts for AI-assisted feature development.

### Documentation Structure

```
docs/
├── prompt-engineering/          # Templates and guides
│   ├── README.md                # Quick reference
│   ├── guides/                  # Conceptual guides
│   │   ├── xml-fundamentals.md  # XML tags, nesting
│   │   ├── context-engineering.md # 6-layer context stack
│   │   └── claude-4x-guidelines.md # Claude 4.x tips
│   └── templates/               # XML templates by category
│       ├── general/             # System prompts, few-shot
│       ├── reasoning/           # Chain-of-thought, analysis
│       ├── code/                # Generation, review
│       ├── agents/              # Context stack, security
│       ├── data/                # Extraction, synthesis
│       └── features/            # Feature development
└── prompts/                     # Active feature prompts
    └── <feature-slug>/          # One folder per feature
        ├── status.md            # Progress tracking
        ├── investigation/       # Research phase
        └── phases/              # Implementation phases
```

### Feature Development Workflow

1. **Create feature folder**:
   ```bash
   mkdir -p docs/prompts/<feature-slug>/{investigation,phases}
   touch docs/prompts/<feature-slug>/status.md
   ```

2. **Investigation phase**: Create `investigation/prompt.xml` using `templates/features/investigation.xml`
   - Analyze codebase
   - Document findings in `investigation/findings.md`
   - Generate phase prompts

3. **Implementation phases**: Execute `phases/01_*.xml`, `phases/02_*.xml`, etc.
   - Each phase is standalone
   - Update `status.md` after EVERY execution

### Key Templates

| Template | Location | Use For |
|----------|----------|---------|
| Investigation | `templates/features/investigation.xml` | Initial research |
| Feature Prompt | `templates/features/feature-prompt.xml` | Implementation phases |
| Claude 4.x Optimized | `templates/agents/claude-4x-optimized.xml` | Claude-specific prompts |
| Context Stack | `templates/agents/context-stack.xml` | Agent context |

### Claude 4.x Guidelines

- **Be explicit**: Claude 4.x is literal - does exactly what you ask
- **Avoid "think"**: Use "consider", "evaluate", "analyze" instead (when extended thinking is off)
- **Prevent over-engineering**: Add constraints like "keep solution minimal"
- **Provide motivation**: Explain WHY for better results

See `docs/prompt-engineering/guides/claude-4x-guidelines.md` for details.

### Rules

1. **Always update status.md** after every prompt execution
2. **Keep phases standalone** - Each phase works independently
3. **Document decisions** - Explain why, not just what
4. **Use templates** from `docs/prompt-engineering/templates/`
5. **Use real dates**: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
6. **Commit after each phase**: Use format `feat(<feature-slug>): <phase> - <description>`
