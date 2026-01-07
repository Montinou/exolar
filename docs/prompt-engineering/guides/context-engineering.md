# Context Engineering

The evolution from prompt engineering to context engineering for AI agents (2026).

## What is Context Engineering?

**Prompt Engineering**: Methods for writing and organizing LLM instructions.

**Context Engineering**: Strategies for curating and maintaining the optimal set of information during LLM inference - including everything beyond just the prompt.

> "Building with language models is becoming less about finding the right words and phrases for prompts, and more about answering: what configuration of context is most likely to generate the model's desired behavior?"
> — Anthropic

## Why It Matters

According to LangChain's 2025 State of Agent Engineering report:
- 57% of organizations have AI agents in production
- 32% cite quality as the top barrier
- **Most failures traced to poor context management, not LLM capabilities**

> "The main thing that determines whether an agent succeeds or fails is the quality of the context you give it. Most agent failures are not model failures—they are context failures."

## The 6-Layer Context Stack

Modern agents need a full context stack with six layers:

```
┌─────────────────────────────────────┐
│ 1. System Instructions              │ ← Identity, capabilities, rules
├─────────────────────────────────────┤
│ 2. Long-term Memory                 │ ← Persistent knowledge, preferences
├─────────────────────────────────────┤
│ 3. Retrieved Documents              │ ← RAG, relevant context
├─────────────────────────────────────┤
│ 4. Tool Definitions                 │ ← Available actions, schemas
├─────────────────────────────────────┤
│ 5. Conversation History             │ ← Recent interactions
├─────────────────────────────────────┤
│ 6. Current Task                     │ ← Immediate request
└─────────────────────────────────────┘
```

### Layer Details

| Layer | Purpose | Example |
|-------|---------|---------|
| **System Instructions** | Define identity and boundaries | "You are a code reviewer focused on security" |
| **Long-term Memory** | Persistent context across sessions | User preferences, past decisions |
| **Retrieved Documents** | Relevant information for current task | RAG results, documentation |
| **Tool Definitions** | Available actions and their schemas | API endpoints, function signatures |
| **Conversation History** | Recent context | Last 5-10 messages |
| **Current Task** | Immediate request | The user's current question |

## Prompt Engineering vs Context Engineering

| Aspect | Prompt Engineering | Context Engineering |
|--------|-------------------|---------------------|
| **Focus** | What words to use | What information to include |
| **Scope** | Single prompt | Full context window |
| **State** | Stateless | Stateful across interactions |
| **Complexity** | Simple tasks | Autonomous agents |
| **Failure Mode** | Wrong instructions | Wrong context |

## Why Agents Fail

Common context failures:

1. **Missing context**: Agent doesn't have information it needs
2. **Stale context**: Information is outdated
3. **Conflicting context**: Different sources contradict
4. **Overwhelming context**: Too much irrelevant information
5. **Unstructured context**: Hard for model to parse

## Best Practices

### 1. Curate Ruthlessly
Only include information relevant to the current task. More context ≠ better results.

### 2. Structure Clearly
Use XML tags or clear sections to delineate different context types.

### 3. Update Dynamically
Refresh context based on task progression and new information.

### 4. Prioritize Recency
Recent information typically matters more than old information.

### 5. Validate Consistency
Check that different context sources don't contradict each other.

## Implementation Pattern

```xml
<context_stack>
  <system_instructions>
    <identity>Senior code reviewer</identity>
    <capabilities>Code analysis, security review</capabilities>
    <constraints>Focus on critical issues only</constraints>
  </system_instructions>

  <long_term_memory>
    <user_preference>Prefers concise feedback</user_preference>
    <past_decision>Uses TypeScript strict mode</past_decision>
  </long_term_memory>

  <retrieved_docs>
    <doc source="codebase">{{RELEVANT_CODE}}</doc>
    <doc source="standards">{{CODING_STANDARDS}}</doc>
  </retrieved_docs>

  <tools>
    <tool name="search_code">Search codebase for patterns</tool>
    <tool name="run_tests">Execute test suite</tool>
  </tools>

  <conversation_history>
    {{RECENT_MESSAGES}}
  </conversation_history>

  <current_task>
    Review the pull request for security vulnerabilities
  </current_task>
</context_stack>
```

## Research Findings

Stanford University, SambaNova Systems, and UC Berkeley released the ACE framework:
- **10.6% improvement** on agentic tasks
- **8.6% gains** on financial reasoning
- **86.9% latency reduction**
- Editing context outperformed model fine-tuning

## Sources

- [Context Engineering for AI Agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Engineering - Gartner](https://www.gartner.com/en/articles/context-engineering)
- [Context Engineering Guide - Prompting Guide](https://www.promptingguide.ai/guides/context-engineering-guide)
- [LangChain State of Agent Engineering 2025](https://langchain.com)

---
*Last updated: January 2026*
