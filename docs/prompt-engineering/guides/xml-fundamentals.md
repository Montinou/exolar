# XML Fundamentals

Core principles for using XML tags in LLM prompts.

## Why Use XML Tags

| Benefit | Description |
|---------|-------------|
| **Clarity** | Separate instructions, context, examples |
| **Accuracy** | Reduce misinterpretation |
| **Flexibility** | Easy to modify sections |
| **Parseability** | Extract specific parts from responses |

## Core Principles

### 1. Semantic Naming

```xml
<!-- Good -->
<task_instructions>Analyze the data...</task_instructions>
<user_query>What is the trend?</user_query>

<!-- Avoid -->
<section1>Analyze the data...</section1>
<input>What is the trend?</input>
```

### 2. Consistency

Reference tags explicitly in instructions:

```xml
<instructions>
Using the data in <customer_data> tags, analyze patterns in <transactions>.
</instructions>

<customer_data>{{DATA}}</customer_data>
<transactions>{{TRANSACTIONS}}</transactions>
```

### 3. Proper Nesting

```xml
<outer>
  <inner>
    <deepest>Content</deepest>
  </inner>
</outer>
```

### 4. Always Close Tags

```xml
<!-- Correct -->
<instructions>Your task is to...</instructions>

<!-- Never do this -->
<instructions>Your task is to...
```

## Common Tags Reference

### Structure Tags

| Tag | Purpose |
|-----|---------|
| `<task>` | Main objective |
| `<context>` | Background information |
| `<instructions>` | Step-by-step directions |
| `<constraints>` | Limitations and rules |
| `<output_format>` | Response structure |

### Content Tags

| Tag | Purpose |
|-----|---------|
| `<document>` | Source documents |
| `<data>` | Raw data to process |
| `<user_input>` | User-provided content |
| `<code>` | Code snippets |

### Example Tags

| Tag | Purpose |
|-----|---------|
| `<examples>` | Container for examples |
| `<example>` | Single example with input/output |
| `<formatting_example>` | Output format reference |

### Reasoning Tags

| Tag | Purpose |
|-----|---------|
| `<thinking>` | Chain-of-thought reasoning |
| `<reasoning>` | Explanation of logic |
| `<analysis>` | Detailed examination |
| `<answer>` | Final response |

## Hierarchical Structure

```
Level 1: Global Scope (task, context, persona)
  └── Level 2: Execution Details (instructions, constraints)
        └── Level 3: Specific Data (examples, documents)
              └── Level 4: Metadata (attributes)
```

## Best Practices

### Match Nesting Depth to Complexity

| Complexity | Levels |
|------------|--------|
| Simple | 1-2 |
| Standard | 2-3 |
| Complex | 3-4 (max) |

### Use Attributes for Metadata

```xml
<!-- Good: attributes for metadata -->
<message role="user" timestamp="2026-01-07">
  What is the status?
</message>

<!-- Avoid: excessive nesting -->
<message>
  <role>user</role>
  <timestamp>2026-01-07</timestamp>
  <content>What is the status?</content>
</message>
```

### Naming Convention

Use `snake_case` (recommended by Anthropic):

```xml
<user_input>...</user_input>
<output_format>...</output_format>
```

### Escape Special Characters

| Character | Escape |
|-----------|--------|
| `<` | `&lt;` |
| `>` | `&gt;` |
| `&` | `&amp;` |
| `"` | `&quot;` |
| `'` | `&apos;` |

## When to Use XML

### Use XML When:
- 3+ distinct sections
- Separating user input (injection prevention)
- Multi-step reasoning
- Multiple data sources
- Need parseable output
- Tracking state across turns

### Skip XML When:
- Simple, single-task prompts
- Conversational queries
- Modern models understand context without it

## Sources

- [Use XML tags - Claude Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)
- [Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)

---
*Last updated: January 2026*
