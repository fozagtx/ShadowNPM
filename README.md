# ShadowNPM

> Trust nothing. Verify everything.

Autonomous npm supply chain security auditor powered by agentic AI. Scans packages through a 6-phase security pipeline, generates exploit tests, and delivers verifiable verdicts — all for $0.001 USDC per audit via Arc nanopayments.

## Why

npm is the largest software registry on earth. Supply chain attacks (event-stream, ua-parser-js, colors.js) cause millions in damage. Developers install packages blindly. ShadowNPM gives every package a security verdict before it touches your machine.

## How it works

```
User clicks "Audit lodash"
    │
    ├── 1. Frontend GETs /payment-info
    │       Returns { token, amount, payTo } for Arc testnet USDC
    │
    ├── 2. MetaMask sends $0.001 USDC to engine's payee address
    │       Standard ERC-20 transfer on Arc testnet
    │
    ├── 3. Frontend POSTs /verify-payment with txHash
    │       Engine verifies Transfer event on-chain, returns token
    │
    ├── 4. Frontend POSTs /audit/stream with paymentToken
    │       Engine validates token, starts audit
    │
    └── 5. 6-Phase AI Audit Pipeline runs:
            ┌─ Phase 0: Resolve ─── Download & extract package from npm
            ├─ Phase 0: Inventory ─ Structural checks (lifecycle scripts, binaries, obfuscation)
            ├─ Phase 1: Triage ──── LLM scans every file, scores risk 0-10
            ├─ Phase 2: Investigate ─ Agentic LLM with tools:
            │                         readFile, searchFiles, evalJs, requireAndTrace
            ├─ Phase 3: Test Gen ── AI writes Vitest exploit tests from findings
            └─ Phase 4: Verify ──── Runs tests via child_process
                                    ↓
                              SAFE or DANGEROUS
                              (with proof: test code, evidence, capabilities)
```

### Live UI

The frontend streams the entire pipeline in real-time:
- **Activity feed** — watch the AI agent reason, call tools, discover findings
- **Code viewer** — see the exact source files being analyzed
- **File explorer** — color-coded risk assessment per file
- **Results panel** — findings with verification status, evidence, exploit test code

## Payment Model

Every audit costs **$0.001 USDC** on Arc testnet. Payments are **mandatory** — the engine refuses to start without a payee address configured.

### Flow

1. Frontend gets payment details from `/payment-info`
2. User sends USDC via MetaMask to the engine's address
3. Engine verifies the Transfer event on-chain
4. Verified payment token unlocks `/audit/stream`

No gas for the user (Arc covers it). No custom contracts. Just a standard USDC transfer.

### Why Arc makes sub-cent pricing viable

| Settlement Layer | Gas per TX | Viable at $0.001/audit? |
|-----------------|------------|------------------------|
| Ethereum L1 | $0.50 – $5.00 | No |
| L2 (Optimism, Arbitrum) | $0.01 – $0.05 | No |
| **Arc (nanopayments)** | **~$0** | **Yes** |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  Vite + Tailwind + Zustand + CodeMirror + Lenis      │
│  SSE streaming • MetaMask wallet                      │
└──────────────┬──────────────────────────────────────┘
               │ POST /audit/stream (with paymentToken)
               ▼
┌─────────────────────────────────────────────────────┐
│                Engine (Hono + TypeScript)              │
│  CORS • SSE events • Queue (one audit at a time)      │
├───────────────────────────────────────────────────────┤
│  Resolve → Inventory → Triage → Investigate →         │
│  Test Gen → Verify → Verdict                          │
├───────────────────────────────────────────────────────┤
│  LLM: OpenRouter (Claude 3.5 Haiku / Sonnet 4)       │
│  Sandbox: child_process (native, no Docker)           │
│  Settlement: Arc testnet (USDC)                        │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 22+
- MetaMask or compatible wallet
- OpenRouter API key

### One env var

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key
```

That's it. Base URL, payee address, and model IDs are all hardcoded in `config.ts`. Override via `SHADOWNPM_*` vars if needed.

### Run locally

```bash
# Start the engine
cd engine
npm install
OPENROUTER_API_KEY=sk-or-v1-... npx tsx src/index.ts   # Starts on :8000

# Start the frontend (separate terminal)
cd frontend
npm install
npm run dev                                              # Starts on :3000
```

## Deploy to Railway

```
OPENROUTER_API_KEY=sk-or-v1-your-key
```

Paste that one env var in Railway. No Docker needed — the sandbox runs via native `child_process`.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite + Tailwind CSS + Zustand + CodeMirror 6 |
| Engine | TypeScript + Hono + Vercel AI SDK |
| Payment | $0.001 USDC on Arc testnet (verified on-chain) |
| LLM | OpenRouter — Claude 3.5 Haiku / Claude Sonnet 4 |
| Sandbox | Native child_process with memory/timeout limits |
| Settlement | Arc testnet |

## Project Structure

| Directory | Description |
|-----------|-------------|
| `frontend/` | React + Vite dashboard — live audit streaming, payment UI |
| `engine/` | TypeScript audit pipeline — 6-phase AI security analysis |
| `scripts/` | Demo scripts |
| `sandbox/` | Exploit harness (Vitest, no Docker needed) |
