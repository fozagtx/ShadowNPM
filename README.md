# ShadowNPM

> Trust nothing. Verify everything.

Autonomous npm supply chain security auditor powered by agentic AI. Scans packages through a 6-phase security pipeline, generates exploit tests, and delivers verifiable verdicts — all for $0.001 USDC per audit via x402 nanopayments on Arc.

**Built for the [Agentic Economy on Arc](https://lablab.ai/ai-hackathons/nano-payments-arc) hackathon — Per-API Monetization Engine track.**

## Why

npm is the largest software registry on earth. Supply chain attacks (event-stream, ua-parser-js, colors.js) cause millions in damage. Developers install packages blindly. ShadowNPM gives every package a security verdict before it touches your machine.

## How it works

```
User clicks "Audit lodash"
    │
    ├── 1. Frontend POSTs /audit/stream
    │       Engine returns HTTP 402 (Payment Required)
    │
    ├── 2. Wallet signs x402 EIP-3009 USDC authorization ($0.001)
    │       No gas needed — uses USDC's native transferWithAuthorization
    │
    ├── 3. Frontend retries with PAYMENT-SIGNATURE header
    │       Engine verifies payment via x402 facilitator
    │
    └── 4. 6-Phase AI Audit Pipeline runs:
            ┌─ Phase 0: Resolve ─── Download & extract package from npm
            ├─ Phase 0: Inventory ─ Structural checks (lifecycle scripts, binaries, obfuscation)
            ├─ Phase 1: Triage ──── LLM scans every file, scores risk 0-10
            ├─ Phase 2: Investigate ─ Agentic LLM in Docker sandbox with tools:
            │                         readFile, searchFiles, evalJs, requireAndTrace
            ├─ Phase 3: Test Gen ── AI writes Vitest exploit tests from findings
            └─ Phase 4: Verify ──── Runs tests in isolated Docker container
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

## x402 Payment Model

ShadowNPM uses [x402](https://x402.org/) — the HTTP 402 Payment Required protocol by Circle. Every audit costs **$0.001 USDC**, settled on Arc testnet.

### How x402 works

1. Client sends `POST /audit` without payment
2. Server returns `402 Payment Required` with payment requirements in headers
3. Client signs EIP-3009 USDC authorization (no gas, just a signature)
4. Client retries with `PAYMENT-SIGNATURE` header containing the signed authorization
5. Server verifies via the x402 facilitator and runs the audit

No custom smart contracts. No gas tokens. No transaction fees for the user. Just sign and go.

### Why Arc makes sub-cent pricing viable

| Settlement Layer | Gas per TX | Viable at $0.001/audit? |
|-----------------|------------|------------------------|
| Ethereum L1 | $0.50 – $5.00 | No — gas exceeds service price by 500-5000x |
| L2 (Optimism, Arbitrum) | $0.01 – $0.05 | No — gas still 10-50x the service price |
| **Arc (nanopayments)** | **~$0** | **Yes — aggregates thousands of payments into single settlement** |

Arc nanopayments batch many micropayments off-chain and settle them in a single on-chain transaction. This makes a $0.001 service economically viable — impossible on any other chain.

**Margin**: At $0.001 revenue per audit, the primary cost is LLM inference (~$0.0003 per audit using Qwen 2.5 Coder 32B via Featherless AI). That's a ~70% gross margin — sustainable only because Arc eliminates per-transaction gas overhead.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  Vite + Tailwind + Zustand + CodeMirror + Lenis      │
│  SSE streaming • x402 wallet • passkey/MetaMask       │
└──────────────┬───────────────────────────────────────┘
               │ POST /audit/stream (with x402 payment)
               ▼
┌─────────────────────────────────────────────────────┐
│                Engine (Hono + TypeScript)              │
│  x402 middleware (@x402/hono) • CORS • SSE events     │
├───────────────────────────────────────────────────────┤
│  Resolve → Inventory → Triage → Investigate →         │
│  Test Gen → Verify → Verdict                          │
├───────────────────────────────────────────────────────┤
│  LLM: Featherless AI (Qwen 2.5 Coder 32B)            │
│  Sandbox: Docker (node:22-slim, network: none)        │
│  Settlement: Arc testnet (USDC nanopayments)            │
└─────────────────────────────────────────────────────┘
```

## Project Structure

| Directory | Description |
|-----------|-------------|
| `frontend/` | React + Vite dashboard — live audit streaming, x402 payment UI |
| `engine/` | TypeScript audit pipeline — 6-phase AI security analysis |
| `scripts/` | Demo scripts (50+ transaction generator) |
| `sandbox/` | Dynamic exploitation harness (Vitest in Docker) |

## Quick Start

### Prerequisites

- Node.js 22+
- Docker (for sandbox phases)
- MetaMask or compatible wallet (for paid audits)

### Run locally

```bash
# 1. Start the engine
cd engine
cp .env.template .env    # Edit: set SHADOWNPM_PAYEE_ADDRESS, LLM keys
npm install
npx tsx src/index.ts     # Starts on :8000

# 2. Start the frontend
cd frontend
npm install
npm run dev              # Starts on :3000, proxies /api/* to engine
```

### Environment variables (engine)

```bash
# Required
SHADOWNPM_LLM_BACKEND=openai_compatible
SHADOWNPM_LLM_BASE_URL=https://api.featherless.ai/v1
SHADOWNPM_LLM_API_KEY=your_featherless_key

# x402 payment (omit for free mode)
SHADOWNPM_PAYEE_ADDRESS=0xYourWalletAddress
SHADOWNPM_FACILITATOR_URL=https://x402.org/facilitator
SHADOWNPM_AUDIT_PRICE_USD=$0.001

# Per-phase LLM models
SHADOWNPM_TRIAGE_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
SHADOWNPM_INVESTIGATION_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
SHADOWNPM_TEST_GEN_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
```

### Run the 50+ transaction demo

```bash
# Fund a wallet with testnet USDC at https://faucet.circle.com/
SHADOWNPM_PRIVATE_KEY=0x... npx tsx scripts/demo-50tx.ts
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite + Tailwind CSS + Zustand + CodeMirror 6 |
| Engine | TypeScript + Hono + Vercel AI SDK |
| Payment | x402 nanopayments — $0.001 USDC on Arc testnet |
| LLM | Featherless AI — Qwen 2.5 Coder 32B (OpenAI-compatible) |
| Sandbox | Docker (node:22-slim, isolated network) |
| Settlement | Arc testnet (USDC nanopayments via x402) |

## Hackathon

**Track**: Per-API Monetization Engine

**Key innovation**: Every API call (audit) is individually priced and paid for via x402. No subscriptions, no API keys, no billing infrastructure. The protocol itself handles authentication, authorization, and payment in a single HTTP request cycle.

**Circle products used**:
- x402 Nanopayments (USDC micropayments on Arc)
- Arc testnet (stablecoin-native settlement)
- USDC (EIP-3009 transferWithAuthorization)
