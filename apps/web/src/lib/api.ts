import type {
  PositionActionRequest,
  ProofTraderSnapshot,
  RiskPolicy,
  SettingsState,
  StrategyRunnerConfigRequest,
  StrategyToggleRequest
} from "@prooftrader/shared";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4010";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const hasBody = init?.body !== undefined && init?.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const error = await response.json();
      if (error && typeof error.message === "string") {
        message = error.message;
      }
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getSnapshot: (sync = false) =>
    request<ProofTraderSnapshot>(`/api/snapshot${sync ? "?sync=1" : ""}`),

  saveSettings: (payload: Partial<SettingsState>) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  saveRiskPolicy: (payload: RiskPolicy) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/risk/policy", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  saveStrategyRunnerConfig: (payload: Partial<StrategyRunnerConfigRequest>) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/strategy/config", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  toggleStrategy: (payload: StrategyToggleRequest) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/strategy/toggle", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  startStrategyRunner: (payload?: { cadenceSeconds?: number }) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/strategy/runner/start", {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }),

  stopStrategyRunner: () =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/strategy/runner/stop", {
      method: "POST"
    }),

  runStrategyCycle: () =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/strategy/runner/run", {
      method: "POST"
    }),

  positionAction: (id: string, payload: PositionActionRequest) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>(`/api/positions/${id}/action`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  testExchange: () =>
    request<{ ok: boolean; message: string }>("/api/exchange/test", {
      method: "POST"
    }),

  initPaperAccount: (payload?: { balance?: number; currency?: string }) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/kraken/paper/init", {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }),

  syncPaperAccount: () =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/kraken/paper/sync", {
      method: "POST"
    }),

  resetPaperWorkspace: (payload?: { balance?: number; currency?: string }) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/workspace/reset-paper", {
      method: "POST",
      body: JSON.stringify(payload ?? {})
    }),

  executeTrade: (payload: {
    symbol: string;
    side: "LONG" | "SHORT";
    size: number;
    orderType?: "market" | "limit";
    limitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    signalSummary?: string;
    strategy?: string;
    accountMode?: "spot" | "futures";
    leverage?: number;
  }) =>
    request<{ ok: boolean; message: string; snapshot: ProofTraderSnapshot }>("/api/trades/execute", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getRegistration: () =>
    request<{ ok: boolean; registration: unknown }>("/api/identity/registration"),

  getPaperStatus: () =>
    request<unknown>("/api/kraken/paper/status")
};
