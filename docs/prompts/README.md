# Feature Prompts

Structured prompts for AI-assisted feature development. Each feature follows: **Investigation → Documentation → Phases → Implementation**.

## Quick Start

```bash
# Create new feature
mkdir -p docs/prompts/<feature-slug>/{investigation,phases}
touch docs/prompts/<feature-slug>/status.md
```

## Folder Structure

```
docs/prompts/<feature-slug>/
├── status.md                    # Progress tracking (ALWAYS updated)
├── investigation/               # Research phase
│   ├── prompt.xml               # Investigation prompt
│   └── findings.md              # Research output
└── phases/                      # Implementation phases
    ├── 01_<name>.xml            # Phase 1 prompt
    ├── 02_<name>.xml            # Phase 2 prompt
    └── ...
```

## Workflow

### 1. Investigation Phase

Create `investigation/prompt.xml` using [features/investigation.xml](../prompt-engineering/templates/features/investigation.xml) template.

**Input**: Feature requirements
**Output**:
- `investigation/findings.md` - Analysis, decisions, file mappings
- `phases/*.xml` - Generated phase prompts
- `status.md` - Updated with investigation results

### 2. Implementation Phases

Execute each phase prompt sequentially. Each phase:
- Uses [features/feature-prompt.xml](../prompt-engineering/templates/features/feature-prompt.xml) template
- Is standalone (can be run independently)
- Updates `status.md` after completion

```
phases/01_schema.xml    → Database changes    → status.md updated
phases/02_api.xml       → API endpoints       → status.md updated
phases/03_ui.xml        → UI components       → status.md updated
```

## status.md Format

```markdown
# Feature: <Name>

## Current Status
**Phase:** <current>
**Status:** pending | in_progress | completed | blocked

## Last Execution
**Date:** 2026-01-07T14:30:00Z
**Prompt:** phases/01_schema.xml
**Status:** completed

### Summary
What was accomplished.

### Changes Made
- lib/db.ts - Added query function
- app/api/example/route.ts - Created endpoint

### Decisions Made
- Chose X over Y because...

### Next Steps
- Run phases/02_api.xml

### Blockers
- None

---

## History
| Date | Prompt | Phase | Status |
|------|--------|-------|--------|
| 2026-01-07 | investigation/prompt.xml | Investigation | completed |
| 2026-01-07 | phases/01_schema.xml | Schema | completed |
```

## Templates

| Template | Use For |
|----------|---------|
| [investigation.xml](../prompt-engineering/templates/features/investigation.xml) | Initial research |
| [feature-prompt.xml](../prompt-engineering/templates/features/feature-prompt.xml) | Implementation phases |
| [iterative.xml](../prompt-engineering/templates/features/iterative.xml) | Refinement cycles |

See [prompt-engineering/](../prompt-engineering/) for all templates and guides.

## Rules

1. **Update status.md after EVERY prompt execution**
2. **Keep phases standalone** - Each phase should work independently
3. **Document decisions** - Explain why, not just what
4. **Use real dates**: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
5. **Reference templates** - Use templates from `prompt-engineering/templates/`

---
*Last updated: January 2026*
