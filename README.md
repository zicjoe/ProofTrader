# ProofTrader

ProofTrader is a combined track trading agent starter that keeps your generated UI, adds a real Fastify backend, wires Kraken CLI into a proper execution service, and persists state into PostgreSQL through Prisma.

## What changed in this build

This iteration moves the backend off the in memory snapshot and into a database backed read and write flow.

### Added now

- PostgreSQL persistence through Prisma
- Workspace snapshot persistence for the dashboard read model
- Normalized execution tables for trade intents, trades, positions, validation artifacts, logs, and jobs
- Kraken paper trading bootstrap endpoint
- Kraken paper order submission endpoint
- Position close and reduce flows now touch the execution layer instead of only mutating memory
- Snapshot hydration from persisted records on every API read
- Better exchange test flow using Kraken CLI status

## Stack

- Frontend: Vite, React, TypeScript, Tailwind v4
- Backend: Fastify, TypeScript
- Database: PostgreSQL + Prisma
- Exchange adapter: Kraken CLI
- Proof helper: ERC 8004 style registration and validation payload helpers
- Shared models: workspace package

## Project structure

- `apps/web` UI from your generated Figma output, kept intact and wired to the API
- `apps/api` backend, persistence, Kraken execution, proof helpers
- `packages/shared` shared types and seeded demo snapshot

## First run

### 1. Install dependencies

```bash
npm install
```

### 2. Copy the environment file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Start PostgreSQL

If you have Docker Desktop or Docker in WSL:

```bash
npm run db:up
```

If you already use Neon, Supabase, Railway, or another hosted PostgreSQL provider, just paste that connection string into `DATABASE_URL` in `.env`.

### 4. Push the schema and generate the Prisma client

```bash
npm run db:setup
```

### 5. Start the API

```bash
npm run dev:api
```

### 6. Start the web app

Open a second terminal and run:

```bash
npm run dev:web
```

### 7. Open the app

Frontend:

```text
http://localhost:5173
```

API health check:

```text
http://localhost:4010/health
```

## Kraken CLI setup

Keep `KRAKEN_CLI_ENABLED=false` until the `kraken` binary is installed and works in your terminal.

Once Kraken CLI is available:

1. Install the binary from the official repository or release installer
2. Make sure `kraken status` works in the same terminal environment where the API runs
3. Set `KRAKEN_CLI_ENABLED=true`
4. Restart the API
5. Use the Settings page to test the connection and initialize a paper account

## AI strategy copilot

This build can now use an OpenAI compatible chat completion endpoint to review the rule based signal stack before any paper trade is sent.

Add these environment variables to turn it on:

```env
AI_ENABLED=true
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your_key_here
AI_MODEL=your_model_here
```

If the AI variables are missing or the model call fails, the runner safely falls back to the deterministic strategy engine and keeps logging the fallback reason in the Strategy page.

## Important notes about this stage

- This build persists real app state in PostgreSQL
- It is wired for Kraken paper trading first, which is the safest place to prove the flow
- The dashboard still uses a workspace snapshot read model because that matches the UI shape cleanly
- Exchange secrets are currently stored as plain strings inside the persisted settings snapshot. That is acceptable for local hackathon development, but before production you should encrypt them or move them to a secure secret store.

## Useful commands

```bash
npm run db:up
npm run db:setup
npm run db:studio
npm run dev:api
npm run dev:web
npm run build
```

## API endpoints added for execution work

### Existing read endpoints

- `GET /health`
- `GET /api/snapshot`
- `GET /api/identity/registration`
- `GET /api/kraken/status`
- `GET /api/kraken/ticker?symbol=BTC/USD`
- `GET /api/kraken/paper/status`
- `GET /api/kraken/paper/history`

### Existing write endpoints

- `POST /api/settings`
- `POST /api/risk/policy`
- `POST /api/strategy/toggle`
- `POST /api/positions/:id/action`
- `POST /api/exchange/test`

### New write endpoints for the execution flow

- `POST /api/kraken/paper/init`
- `POST /api/trades/execute`

#### Example paper init request

```json
{
  "balance": 10000,
  "currency": "USD"
}
```

#### Example trade execution request

```json
{
  "symbol": "BTC/USD",
  "side": "LONG",
  "size": 0.01,
  "orderType": "market",
  "signalSummary": "Momentum breakout above prior day high",
  "strategy": "Trend Following",
  "stopLoss": 64000,
  "takeProfit": 69000
}
```

## What still comes next

- Real order forms in the UI
- Paper history reconciliation into existing positions and trade states
- Live trading mode separation from paper mode
- Encryption for exchange secrets
- Actual onchain publishing instead of local proof payload generation only
- Auth and team workspaces


## Windows Kraken CLI

If you install Kraken CLI inside WSL, set `KRAKEN_CLI_USE_WSL=true`, `KRAKEN_WSL_PATH=C:\Windows\System32\wsl.exe`, and `KRAKEN_CLI_PATH` to the Linux path of the binary, for example `/home/your-user/.cargo/bin/kraken`.
