# Claude 4.x Guidelines

Model-specific optimizations for Claude Opus 4.5 and Sonnet 4.5 (January 2026).

## Key Behavioral Changes

### Literalness

Claude 4.x does **exactly what you ask**, nothing more:

| Claude 3.x | Claude 4.x |
|------------|------------|
| Infers intent, expands on requests | Takes instructions literally |
| "Above and beyond" by default | Minimal unless explicitly asked |
| May add features/abstractions | Only what's requested |

**Implication**: Be explicit about what you want. If you need elaboration, ask for it.

## Extended Thinking

When extended thinking is **disabled**, Claude Opus 4.5 is sensitive to the word "think":

```xml
<!-- Avoid when extended thinking is off -->
<instructions>Think about the problem...</instructions>

<!-- Use instead -->
<instructions>Consider the problem...</instructions>
<instructions>Evaluate the options...</instructions>
<instructions>Analyze the situation...</instructions>
```

**Alternative words**: consider, believe, evaluate, analyze, examine, reflect

## Preventing Over-Engineering (Opus 4.5)

Claude Opus 4.5 tends to:
- Create extra files
- Add unnecessary abstractions
- Build in flexibility that wasn't requested
- Over-document

**Add explicit constraints**:

```xml
<constraints>
  <rule>Keep the solution minimal</rule>
  <rule>Only create files explicitly requested</rule>
  <rule>No unnecessary abstractions</rule>
  <rule>Avoid premature optimization</rule>
  <rule>Don't add features beyond requirements</rule>
</constraints>
```

## Subagent Orchestration (Sonnet 4.5)

Claude 4.5 can recognize when tasks benefit from delegation and do so proactively:

```xml
<task>
  <objective>Refactor the authentication system</objective>
  <orchestration_hint>
    Consider delegating specialized subtasks to appropriate agents
  </orchestration_hint>
</task>
```

## Parallel Tool Execution

Sonnet 4.5 is aggressive with parallel operations. To control this:

```xml
<execution_mode>
  <!-- For sequential tasks -->
  <preference>sequential</preference>
  <reason>These operations have dependencies</reason>
</execution_mode>

<execution_mode>
  <!-- For independent tasks -->
  <preference>parallel</preference>
  <reason>These operations are independent</reason>
</execution_mode>
```

## Context and Motivation

Providing **why** improves results:

```xml
<!-- Without motivation -->
<instructions>Add input validation</instructions>

<!-- With motivation (better) -->
<instructions>
  Add input validation to prevent SQL injection attacks.
  This is critical because the endpoint accepts user-generated content.
</instructions>
```

## Long-Horizon Tasks

Claude 4.5 excels at extended sessions with:
- Exceptional state tracking
- Incremental progress focus
- Maintained orientation across many steps

**Best practice**: Let it work incrementally rather than attempting everything at once.

## Quick Reference

| Scenario | Recommendation |
|----------|----------------|
| Need minimal solution | Add explicit "keep it simple" constraints |
| Extended thinking off | Avoid "think", use "consider/evaluate" |
| Complex multi-step task | Let model work incrementally |
| Independent operations | Allow parallel execution |
| Dependent operations | Specify sequential mode |
| Want elaboration | Explicitly request it |
| Using Opus for code | Add anti-over-engineering rules |

## Model Comparison

| Feature | Opus 4.5 | Sonnet 4.5 |
|---------|----------|------------|
| **Best for** | Complex reasoning, long tasks | Fast iteration, code generation |
| **Context** | 200K tokens | 200K tokens |
| **Max output** | 32K tokens | 64K tokens |
| **Tendencies** | Over-engineering | Aggressive parallelism |
| **Price (input)** | $15/M tokens | $3/M tokens |
| **Price (output)** | $75/M tokens | $15/M tokens |

## Example: Optimized Prompt

```xml
<system_prompt>
  <persona>
    <role>Senior developer</role>
    <style>Concise, practical</style>
  </persona>

  <task>
    <objective>{{OBJECTIVE}}</objective>
    <motivation>{{WHY_THIS_MATTERS}}</motivation>
  </task>

  <constraints>
    <rule priority="high">Keep solution minimal</rule>
    <rule priority="high">Only modify requested files</rule>
    <rule priority="medium">No unnecessary abstractions</rule>
  </constraints>

  <output_format>
    <style>Code with brief explanations</style>
    <length>As short as possible</length>
  </output_format>
</system_prompt>
```

## Sources

- [Claude 4.x Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Claude 4 System Prompt Analysis](https://www.prompthub.us/blog/an-analysis-of-the-claude-4-system-prompt)
- [Complete Guide to Claude Opus 4 and Sonnet 4](https://www.prompthub.us/blog/the-complete-guide-to-claude-opus-4-and-claude-sonnet-4)

---
*Last updated: January 2026*
