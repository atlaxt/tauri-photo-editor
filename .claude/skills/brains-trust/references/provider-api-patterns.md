# Provider API Patterns

Python patterns for calling each provider. The generated script should use `urllib` (stdlib) — no pip dependencies.

## Key Detection

```python
import os

OPENROUTER_KEY = os.environ.get('OPENROUTER_API_KEY')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY')
OPENAI_KEY = os.environ.get('OPENAI_API_KEY')

if not any([OPENROUTER_KEY, GEMINI_KEY, OPENAI_KEY]):
    print("ERROR: No API keys found. Set at least one of:")
    print("  OPENROUTER_API_KEY (recommended — covers all providers)")
    print("  GEMINI_API_KEY")
    print("  OPENAI_API_KEY")
    sys.exit(1)
```

## Fetching Current Models

```python
import urllib.request, json

def get_current_models():
    """Fetch current leading models from models.flared.au"""
    req = urllib.request.Request(
        'https://models.flared.au/json',
        headers={'User-Agent': 'brains-trust/1.0'}
    )
    resp = urllib.request.urlopen(req, timeout=10)
    return json.loads(resp.read())
```

## OpenRouter (Universal — All Providers)

OpenRouter uses the OpenAI-compatible chat completions API. Any model available on OpenRouter can be called this way.

```python
def call_openrouter(model_id, prompt, api_key):
    """Call any model via OpenRouter. Do NOT set max_tokens."""
    payload = json.dumps({
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        # No max_tokens — let the model reason fully
    }).encode()

    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/jezweb/claude-skills',
            'X-Title': 'Brains Trust',
        }
    )
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    return result['choices'][0]['message']['content']
```

## Google Gemini (Direct)

```python
def call_gemini(model_id, prompt, api_key):
    """Call Gemini directly. Do NOT set maxOutputTokens."""
    # Strip provider prefix if present
    model = model_id.replace('google/', '')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3
            # No maxOutputTokens — let the model reason fully
        }
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'brains-trust/1.0'
        }
    )
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    return result['candidates'][0]['content']['parts'][0]['text']
```

## OpenAI (Direct)

```python
def call_openai(model_id, prompt, api_key):
    """Call OpenAI directly. Do NOT set max_tokens."""
    # Strip provider prefix if present
    model = model_id.replace('openai/', '')

    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        # No max_tokens — let the model reason fully
    }).encode()

    req = urllib.request.Request(
        'https://api.openai.com/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
    )
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    return result['choices'][0]['message']['content']
```

## Routing: Model ID → Provider

```python
def call_model(model_id, prompt):
    """Route a model ID to the correct API."""
    # Prefer direct keys when available for the provider
    if model_id.startswith('google/') and GEMINI_KEY:
        return call_gemini(model_id, prompt, GEMINI_KEY)
    elif model_id.startswith('openai/') and OPENAI_KEY:
        return call_openai(model_id, prompt, OPENAI_KEY)
    elif OPENROUTER_KEY:
        return call_openrouter(model_id, prompt, OPENROUTER_KEY)
    else:
        raise ValueError(f"No API key available for {model_id}")
```

## Parallel Execution (Consensus Mode)

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def call_consensus(model_ids, prompt):
    """Call multiple models in parallel, return all results."""
    results = {}
    with ThreadPoolExecutor(max_workers=len(model_ids)) as executor:
        futures = {
            executor.submit(call_model, mid, prompt): mid
            for mid in model_ids
        }
        for future in as_completed(futures):
            model_id = futures[future]
            try:
                results[model_id] = future.result()
            except Exception as e:
                results[model_id] = f"ERROR: {e}"
    return results
```

## Error Handling

```python
try:
    result = call_model(model_id, prompt)
except urllib.error.HTTPError as e:
    body = e.read().decode() if e.fp else ''
    print(f"HTTP {e.code}: {body[:500]}")
    if e.code == 401:
        print("Check your API key is valid and has credits")
    elif e.code == 429:
        print("Rate limited — wait a moment and retry")
    elif e.code == 404:
        print(f"Model '{model_id}' not found — check models.flared.au for current IDs")
    sys.exit(1)
except urllib.error.URLError as e:
    print(f"Connection error: {e.reason}")
    sys.exit(1)
```

## Consultation Directory

Each consultation saves to its own timestamped directory for history:

```
.jez/artifacts/brains-trust/
├── 2026-03-10-1423-auth-architecture/
│   ├── prompt.txt
│   ├── gemini-2.5-pro.md
│   └── qwen3.5-plus.md
└── 2026-03-10-1545-db-schema-review/
    ├── prompt.txt
    └── gpt-5.4.md
```

The directory name uses `{YYYY-MM-DD-HHmm}-{topic-slug}` where the topic slug is a 2-3 word kebab-case summary of the consultation topic (e.g. `auth-architecture`, `db-schema-review`, `blind-spots`).

## Script Structure

The generated `brains-trust.py` should follow this structure:

```python
#!/usr/bin/env python3
"""Brains Trust — multi-model consultation"""
import os, sys, json, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# 1. Check keys
# 2. Consultation dir passed as sys.argv[1]
# 3. Read prompt from {consultation_dir}/prompt.txt
# 4. Define call functions (from patterns above)
# 5. Call model(s) — print progress to stderr
# 6. Save each response to {consultation_dir}/{model-slug}.md
# 7. Print results to stdout
```

## Critical Rules

1. **Never set `max_tokens` or `maxOutputTokens`** — let models use their full reasoning capacity
2. **Always set `User-Agent`** header — Python's default UA gets blocked by Cloudflare Bot Fight Mode
3. **Use 120s timeout** — pro models with long reasoning can take 30-60s
4. **Write prompts to file** — never pass via bash arguments (shell escaping breaks on apostrophes, quotes)
5. **Handle errors gracefully** — show the HTTP status and body, suggest fixes
