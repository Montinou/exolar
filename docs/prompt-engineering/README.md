# Prompt Engineering Guide

Quick reference for XML prompts and context engineering (January 2026).

## Guides

| Guide | Description |
|-------|-------------|
| [XML Fundamentals](guides/xml-fundamentals.md) | Tags, nesting, best practices |
| [Context Engineering](guides/context-engineering.md) | 6-layer context stack for agents |
| [Claude 4.x Guidelines](guides/claude-4x-guidelines.md) | Model-specific optimizations |

## Templates

See [templates/_index.xml](templates/_index.xml) for full catalog.

| Category | Use Case |
|----------|----------|
| [general/](templates/general/) | System prompts, few-shot learning |
| [reasoning/](templates/reasoning/) | Chain-of-thought, document analysis |
| [code/](templates/code/) | Code generation and review |
| [agents/](templates/agents/) | Context stack, conversational agents, security |
| [data/](templates/data/) | Data extraction, multi-source synthesis |
| [features/](templates/features/) | Feature development workflows |

## Commit Convention

Every phase prompt execution must end with:
1. Update `status.md` (mandatory_final_step)
2. Commit changes (mandatory_commit_step)

**Commit format:**
```
feat(<feature-slug>): <phase> - <brief description>
```

Examples:
- `feat(db-refactor): investigation - Initial analysis complete`
- `feat(db-refactor): phase-01 - Setup folder structure`
- `feat(db-refactor): phase-02 - Extract utility functions`

## Quick Tips

```
1. Use XML for 3+ sections
2. Claude 4.x is literal - be explicit
3. Avoid "think" → use "consider", "believe", "evaluate"
4. Provide motivation/context for better results
5. For agents: focus on context engineering, not just prompts
```

## When to Use XML

| Scenario | Use XML? |
|----------|----------|
| 3+ distinct sections | Yes |
| Preventing prompt injection | Yes |
| Need parseable output | Yes |
| Multi-step reasoning | Yes |
| Simple query | No |
| Conversational chat | No |

## Sources

- [Claude 4.x Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
- [XML Tags Guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)
- [Context Engineering - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

---
*Last updated: January 2026*
