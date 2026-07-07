# Engine

TypeScript audit pipeline — inventory, LLM static analysis, agentic investigation, and sandbox execution.

## Prerequisites

- Node.js 22+
- OpenRouter API key

## Quick Start

```bash
npm install
OPENROUTER_API_KEY=sk-or-v1-... npx tsx src/index.ts   # :8000
```

Trigger an audit:

```bash
curl -X POST http://localhost:8000/audit \
     -H "Content-Type: application/json" \
     -d '{"packageName": "serialize-javascript"}'
```

Health check at `http://localhost:8000/health`.

## Configuration

Only `OPENROUTER_API_KEY` is required. All other values have sensible defaults.

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | _(required)_ | OpenRouter API key |
| `SHADOWNPM_PAYEE_ADDRESS` | hardcoded in config.ts | Address to receive USDC payments |
| `SHADOWNPM_TRIAGE_MODEL` | `anthropic/claude-3-haiku` | Model for triage phase |
| `SHADOWNPM_INVESTIGATION_MODEL` | `anthropic/claude-sonnet-4` | Model for investigation |
| `SHADOWNPM_TEST_GEN_MODEL` | `anthropic/claude-sonnet-4` | Model for test generation |
| `SHADOWNPM_INVESTIGATION_ENABLED` | `true` | Set `false` to skip investigation |
| `SHADOWNPM_SANDBOX_MEMORY_MB` | `512` | Sandbox memory limit |
| `SHADOWNPM_SANDBOX_CPUS` | `1` | Sandbox CPU quota |
| `SHADOWNPM_MAX_AGENT_TURNS` | `30` | Max tool-call turns |
| `SHADOWNPM_VERIFY_TIMEOUT_SEC` | `60` | Vitest run timeout |

## Pipeline

```
npm package → Phase 0: Inventory → Phase 1: Triage → Phase 2: Investigate → Phase 3: Test Gen → Phase 4: Verify → AuditReport
```

## Sandbox

The investigation phase runs untrusted package code via `child_process` with:
- Memory limits (`--max-old-space-size`)
- Hard timeouts per command
- Prompt injection detection in output

No Docker required. Works on Railway, Fly.io, any Node.js host.
