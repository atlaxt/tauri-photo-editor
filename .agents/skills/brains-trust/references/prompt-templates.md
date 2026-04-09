# Prompt Templates

## AI-to-AI Framing

Always use this header when constructing prompts. It prevents role confusion — the consulted model knows it's advising Claude Code, not talking to the human directly.

```
[Claude Code consulting {model_name} for a second opinion]

Task: {specific task description}

{mode-specific instructions}

Provide direct, specific analysis. I will synthesise your findings with mine before presenting to the developer.
```

## File Attachment Format

When including code or file contents in the prompt, use clear separators:

```
--- src/auth.ts ---
{file contents}
--- src/middleware.ts ---
{file contents}
```

Include the full file — don't truncate. Modern models have 400K-1M context windows.

## Per-Mode Templates

### Code Review

```
[Claude Code consulting {model_name} for a second opinion]

Task: Code review — check for bugs, logic errors, security vulnerabilities (injection, XSS, CSRF), performance issues, race conditions, type safety problems, and missing error handling.

Focus on issues that matter, not style nits. Reference specific lines.

Provide direct analysis with file:line references. I will synthesise your findings with mine before presenting to the developer.
```

### Architecture

```
[Claude Code consulting {model_name} for a second opinion]

Task: Architecture advice — {description of the decision or problem}

Analyse for: architectural anti-patterns, scalability concerns, maintainability issues, better alternatives, hidden coupling, and potential technical debt. Consider trade-offs honestly.

Provide specific, actionable recommendations with rationale. I will synthesise your findings with mine before presenting to the developer.
```

### Debug

```
[Claude Code consulting {model_name} for a second opinion]

Task: Debug analysis — identify root cause (not just symptoms), explain the mechanism, suggest a specific fix with code, and how to prevent recurrence.

Error: {error message/description}
What was tried: {previous attempts}

Provide direct analysis with file:line references. I will synthesise your findings with mine before presenting to the developer.
```

### Security

```
[Claude Code consulting {model_name} for a second opinion]

Task: Security audit — check for injection vulnerabilities, authentication/authorisation bypasses, data exposure, insecure defaults, missing input validation, CORS misconfiguration, credential handling, and OWASP Top 10.

Provide analysis with file:line references and severity ratings (critical/high/medium/low). I will synthesise your findings with mine before presenting to the developer.
```

### Strategy

```
[Claude Code consulting {model_name} for a second opinion]

Task: Strategy review — {description of the decision or approach}

Consider: Is this the right approach? What are we missing? What could go wrong? Are there simpler alternatives? What would you do differently?

Be direct and honest. Challenge assumptions. I will synthesise your findings with mine before presenting to the developer.
```

### Prompting

```
[Claude Code consulting {model_name} for a second opinion]

Task: Prompt review — analyse and improve this prompt/system prompt/KB content for clarity, effectiveness, edge case handling, and potential failure modes.

Consider: ambiguous instructions, missing context, contradictions, tone consistency, and whether an LLM would reliably follow these instructions.

Provide specific improvement suggestions with before/after examples. I will synthesise your findings with mine before presenting to the developer.
```

### General

```
[Claude Code consulting {model_name} for a second opinion]

Task: {question or topic}

Give me your honest analysis. Challenge assumptions if you see them. I will synthesise your perspective with mine before presenting to the developer.
```

## Devil's Advocate Framing

When the user wants their position challenged, wrap any mode template with this:

```
IMPORTANT: Your role is devil's advocate. The developer (via Claude Code) currently believes:

{stated position or assumption}

Your job is to argue AGAINST this position. Find the strongest counterarguments, identify what could go wrong, surface assumptions that might be wrong, and present the best case for an alternative approach.

Do not hedge or agree. Push back hard. The goal is to stress-test this thinking, not validate it.
```
