# ProofTrader

ProofTrader is a full stack trading operations platform for paper trading, strategy automation, and auditable execution workflows.

It combines a React dashboard, a Fastify API, PostgreSQL persistence, an AI assisted decision layer, and a hosted Kraken CLI runner. The result is a system where the user interface, backend orchestration, risk controls, execution path, persistence, and logs are clearly separated and can be operated as a real application rather than a single page demo.

## Why ProofTrader

ProofTrader is designed around a simple operating model:

- the frontend is responsible for interaction and visibility
- the backend owns orchestration, validation, and risk logic
- Kraken CLI remains the execution layer
- database persistence remains the source of truth for application state
- logs and proofs make strategy behavior easier to inspect and review

This makes the platform easier to test, extend, and operate than a direct browser to exchange setup.

## Core capabilities

The current codebase includes:

- hosted Kraken CLI integration through a dedicated runner service
- paper trading workspace initialization and reset
- market data retrieval through the runner
- AI assisted strategy loop execution with deterministic fallback behavior
- backend controlled trade execution and position actions
- PostgreSQL persistence through Prisma
- dashboard snapshot hydration from persisted records
- proof and identity payload generation for exportable artifacts
- separation between UI, backend orchestration, execution, and storage

## Architecture

```text
Frontend (Vite / React)
        │
        ▼
ProofTrader API (Fastify)
        │
        ├── strategy orchestration
        ├── risk controls
        ├── persistence via Prisma + PostgreSQL
        ├── snapshot hydration
        └── proof and log generation
                │
                ▼
kraken-runner
        │
        └── Kraken CLI
                │
                ▼
Kraken paper trading environment
```

### Hosted execution path

```text
UI → API → risk checks → strategy / execution service → kraken-runner → Kraken CLI
   → persistence → logs / proofs → synced UI snapshot
```

## Repository structure

```text
apps/
  api/        Fastify API, Prisma, strategy services, Kraken integration
  web/        Vite React frontend dashboard
packages/
  shared/     Shared models and common types
scripts/
  kraken-runner-server.mjs   Hosted runner wrapper around Kraken CLI
```

## Technology stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Fastify, TypeScript
- **Database:** PostgreSQL, Prisma
- **Execution layer:** Kraken CLI through a hosted runner
- **Shared package:** common types and workspace models

## Current scope

ProofTrader currently focuses on paper trading and operational correctness.

Supported workflows include:

- paper account initialization
- paper workspace reset
- market data retrieval
- strategy loop execution
- AI assisted decision review
- trade execution through backend owned flows
- position action handling
- persisted workspace recovery for the dashboard

Live trading separation, secret hardening, and broader production controls are future work.

## Getting started

### Prerequisites

Install these first:

- Node.js 20 or later
- npm
- PostgreSQL, or a hosted PostgreSQL provider such as Railway
- Docker Desktop if you want to use the local Postgres container flow
- Kraken CLI only if you want to run the runner locally

## Local setup

### 1. Install dependencies

Run this in your **project root terminal**:

```bash
npm install
```

### 2. Create your environment file

Run one of these in your **project root terminal**.

On **Windows PowerShell**:

```powershell
Copy-Item .env.example .env
```

On **WSL / Ubuntu terminal** or **macOS Terminal**:

```bash
cp .env.example .env
```

### 3. Configure environment variables

Update `.env` with your own values.

A minimal starting point looks like this:

```env
VITE_API_URL=http://localhost:4010

PORT=4010
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/prooftrader?schema=public

KRAKEN_CLI_ENABLED=false
KRAKEN_CLI_USE_WSL=false
KRAKEN_WSL_PATH=C:\Windows\System32\wsl.exe
KRAKEN_CLI_PATH=kraken
KRAKEN_API_KEY=
KRAKEN_API_SECRET=

AI_ENABLED=false
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=

PROOFTRADER_NETWORK=sepolia
PROOFTRADER_IDENTITY_REGISTRY=0x0000000000000000000000000000000000000000
PROOFTRADER_AGENT_ID=1
PROOFTRADER_AGENT_WALLET=0x1111111111111111111111111111111111111111

DEFAULT_ACCOUNT_MODE=spot
DEFAULT_FUTURES_LEVERAGE=2

KRAKEN_RUNNER_URL=
KRAKEN_RUNNER_TIMEOUT_MS=10000
KRAKEN_RUNNER_GET_RETRIES=2
KRAKEN_RUNNER_STATE_DIR=/data/kraken-runner
```

## Database setup

### Option A: local PostgreSQL with Docker

Run this in your **project root terminal**:

```bash
npm run db:up
npm run db:setup
```

### Option B: hosted PostgreSQL

If you are using Railway or another hosted provider, place the connection string into `DATABASE_URL`, then run this in your **project root terminal**:

```bash
npm run db:setup
```

## Run the application locally

### Start the API

Run this in your **first project root terminal**:

```bash
npm run dev:api
```

### Start the frontend

Run this in your **second project root terminal**:

```bash
npm run dev:web
```

### Open the app

Open this in your **browser address bar**:

```text
http://localhost:5173
```

### Check API health

Open this in your **browser address bar**:

```text
http://localhost:4010/health
```

## Hosted runner configuration

ProofTrader supports a hosted Kraken execution path through `KRAKEN_RUNNER_URL`.

When this value is set on the API, ProofTrader sends market and paper requests to the runner instead of assuming local terminal execution.

Example:

```env
KRAKEN_RUNNER_URL=https://your-runner.up.railway.app
KRAKEN_RUNNER_TIMEOUT_MS=10000
KRAKEN_RUNNER_GET_RETRIES=2
KRAKEN_RUNNER_STATE_DIR=/data/kraken-runner
```

### Runner persistence

If you deploy `kraken-runner` on Railway, attach a persistent volume and mount it at:

```text
/data
```

This allows Kraken CLI paper state to survive restarts and redeploys.

## AI assisted strategy review

ProofTrader can call an OpenAI compatible endpoint during the strategy cycle. This is optional.

Enable it by setting:

```env
AI_ENABLED=true
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your_api_key
AI_MODEL=your_model
```

If the AI path is unavailable, ProofTrader falls back to deterministic strategy behavior so the platform remains operational.

## Operational model

ProofTrader is intentionally structured so AI is not the sole source of truth.

The expected control flow is:

1. market data enters through Kraken via the runner
2. backend services evaluate current workspace state
3. risk controls are applied before execution
4. AI may assist with decision review
5. execution requests pass through backend owned logic
6. resulting state is persisted to PostgreSQL
7. the UI reads a synced snapshot and logs the outcome

## Main API surface

### Read endpoints

- `GET /health`
- `GET /api/snapshot`
- `GET /api/identity/registration`
- `GET /api/kraken/status`
- `GET /api/kraken/ticker`
- `GET /api/kraken/paper/status`
- `GET /api/kraken/paper/history`

### Write endpoints

- `POST /api/settings`
- `POST /api/risk/policy`
- `POST /api/strategy/toggle`
- `POST /api/strategy/config`
- `POST /api/strategy/runner/start`
- `POST /api/strategy/runner/stop`
- `POST /api/strategy/runner/run`
- `POST /api/positions/:id/action`
- `POST /api/exchange/test`
- `POST /api/kraken/paper/init`
- `POST /api/kraken/paper/sync`
- `POST /api/workspace/reset-paper`
- `POST /api/trades/execute`

## Useful commands

Run these in your **project root terminal**:

```bash
npm install
npm run dev
npm run dev:api
npm run dev:web
npm run build
npm run db:up
npm run db:down
npm run db:setup
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

## Deployment model

The intended deployment layout is:

- **Frontend** on Vercel
- **API** on Railway
- **PostgreSQL** on Railway
- **kraken-runner** on Railway
- **persistent runner volume** mounted at `/data`

This keeps the execution path hosted and removes the need to rely on a local WSL session for normal operation.

## Security notes

- the current build is intended for paper trading first
- exchange secrets should be hardened before any live deployment
- risk controls should remain authoritative over AI outputs
- runner health, retry behavior, and persistence should be treated as first class operational concerns
- database persistence should remain part of the source of truth

## Roadmap

Planned next steps include:

- deeper retry and degraded mode handling around sync
- stronger paper and futures behavior validation
- live mode separation from paper mode
- encryption or secure storage for secrets
- stronger observability around execution and proofs
- team and authentication features

## Contribution guidelines

When extending this codebase:

- preserve the hosted runner architecture
- avoid bypassing backend risk controls
- avoid moving execution logic into the frontend
- keep persistence and logs as part of the source of truth
- stabilize paper trading behavior before expanding into live workflows
