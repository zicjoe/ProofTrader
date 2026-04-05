# ProofTrader architecture

## Current architecture

ProofTrader now uses a simple split between a read model and execution records.

### Read model

The UI consumes a single `ProofTraderSnapshot` object.
That snapshot is stored in PostgreSQL as a workspace level JSON document.
On every read, the API hydrates the snapshot with the latest normalized execution records.

### Write model

The backend persists the operational parts of the system into dedicated tables:

- workspaces
- workspace snapshots
- trade intents
- trade executions
- positions
- validation artifacts
- logs
- jobs

This lets the frontend keep its generated UI contract while the backend moves toward a more serious execution pipeline.

## Execution flow

1. Frontend or API client submits a trade request
2. Backend loads the current workspace snapshot
3. Risk policy is checked against the request
4. A trade intent is persisted
5. If approved, the backend submits the order through Kraken CLI paper trading
6. The order response is persisted as a trade execution
7. A position record is created
8. A validation artifact payload is generated and stored
9. Logs and job records are appended
10. The dashboard snapshot is rehydrated and returned to the client

## Position actions

Reducing and closing positions now go through the execution layer instead of only mutating in memory.
That keeps the trade journal, logs, and proof artifacts closer to the real flow we need for the hackathon.

## Why this shape

The generated UI expects one large dashboard payload.
Rewriting that entire frontend into many small API slices would slow down shipping.
So this architecture keeps the UI contract stable while the backend evolves toward a production style service.

## Next backend milestones

- real mark to market refresh for open positions
- paper history reconciliation from Kraken CLI into existing trades
- live mode guardrails separate from paper mode
- secret encryption for stored API settings
- actual onchain publishing workers for ERC 8004 related records
