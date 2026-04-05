import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PositionActionRequest, ProofTraderSnapshot, RiskPolicy, SettingsState, StrategyRunnerConfigRequest } from "@prooftrader/shared";
import { api } from "../lib/api";

type TradeInput = {
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
};

type RefreshOptions = {
  silent?: boolean;
  sync?: boolean;
};

type AppDataContextValue = {
  snapshot: ProofTraderSnapshot | null;
  loading: boolean;
  liveSyncing: boolean;
  lastLiveSyncAt: string | null;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  syncPaperAccount: () => Promise<string>;
  saveSettings: (input: Partial<SettingsState>) => Promise<string>;
  saveRiskPolicy: (input: RiskPolicy) => Promise<string>;
  saveStrategyRunnerConfig: (input: Partial<StrategyRunnerConfigRequest>) => Promise<string>;
  toggleStrategy: (paused: boolean) => Promise<string>;
  startStrategyRunner: (cadenceSeconds?: number) => Promise<string>;
  stopStrategyRunner: () => Promise<string>;
  runStrategyCycle: () => Promise<string>;
  runPositionAction: (positionId: string, action: PositionActionRequest["action"]) => Promise<string>;
  testExchange: () => Promise<string>;
  initPaperAccount: (balance?: number, currency?: string) => Promise<string>;
  resetPaperWorkspace: (balance?: number, currency?: string) => Promise<string>;
  submitTrade: (input: TradeInput) => Promise<string>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<ProofTraderSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [lastLiveSyncAt, setLastLiveSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollInFlightRef = useRef(false);

  const applySnapshot = (nextSnapshot: ProofTraderSnapshot) => {
    setSnapshot(nextSnapshot);
    setLastLiveSyncAt(nextSnapshot.paper.syncedAt ?? nextSnapshot.generatedAt);
    setError(null);
  };

  const refresh = async (options: RefreshOptions = {}) => {
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const nextSnapshot = await api.getSnapshot(options.sync ?? false);
      applySnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshot.");
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void refresh({ sync: true });
  }, []);

  useEffect(() => {
    if (!snapshot?.settings.exchange.connected || !snapshot.settings.exchange.paperTrading) {
      return;
    }

    const sync = async () => {
      if (pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;
      setLiveSyncing(true);
      try {
        const result = await api.syncPaperAccount();
        applySnapshot(result.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sync paper account.");
      } finally {
        pollInFlightRef.current = false;
        setLiveSyncing(false);
      }
    };

    void sync();
    const intervalId = window.setInterval(() => {
      void sync();
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [snapshot?.settings.exchange.connected, snapshot?.settings.exchange.paperTrading]);

  const syncPaperAccount = async () => {
    setLiveSyncing(true);
    try {
      const result = await api.syncPaperAccount();
      applySnapshot(result.snapshot);
      return result.message;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sync paper account.";
      setError(message);
      return message;
    } finally {
      setLiveSyncing(false);
    }
  };

  const saveSettings = async (input: Partial<SettingsState>) => {
    const result = await api.saveSettings(input);
    applySnapshot(result.snapshot);
    return result.message;
  };

  const saveRiskPolicy = async (input: RiskPolicy) => {
    const result = await api.saveRiskPolicy(input);
    applySnapshot(result.snapshot);
    return result.message;
  };

  const saveStrategyRunnerConfig = async (input: Partial<StrategyRunnerConfigRequest>) => {
    const result = await api.saveStrategyRunnerConfig(input);
    applySnapshot(result.snapshot);
    return result.message;
  };

  const toggleStrategy = async (paused: boolean) => {
    const result = await api.toggleStrategy({ paused });
    applySnapshot(result.snapshot);
    return result.message;
  };

  const startStrategyRunner = async (cadenceSeconds?: number) => {
    const result = await api.startStrategyRunner({ cadenceSeconds });
    applySnapshot(result.snapshot);
    return result.message;
  };

  const stopStrategyRunner = async () => {
    const result = await api.stopStrategyRunner();
    applySnapshot(result.snapshot);
    return result.message;
  };

  const runStrategyCycle = async () => {
    const result = await api.runStrategyCycle();
    applySnapshot(result.snapshot);
    return result.message;
  };

  const runPositionAction = async (positionId: string, action: PositionActionRequest["action"]) => {
    const result = await api.positionAction(positionId, { action });
    applySnapshot(result.snapshot);
    return result.message;
  };

  const testExchange = async () => {
    const result = await api.testExchange();
    return result.message;
  };

  const initPaperAccount = async (balance?: number, currency?: string) => {
    const result = await api.initPaperAccount({ balance, currency });
    applySnapshot(result.snapshot);
    return result.message;
  };

  const resetPaperWorkspace = async (balance?: number, currency?: string) => {
    const result = await api.resetPaperWorkspace({ balance, currency });
    applySnapshot(result.snapshot);
    return result.message;
  };

  const submitTrade = async (input: TradeInput) => {
    const result = await api.executeTrade(input);
    applySnapshot(result.snapshot);
    return result.message;
  };

  const value = useMemo(
    () => ({
      snapshot,
      loading,
      liveSyncing,
      lastLiveSyncAt,
      error,
      refresh,
      syncPaperAccount,
      saveSettings,
      saveRiskPolicy,
      saveStrategyRunnerConfig,
      toggleStrategy,
      startStrategyRunner,
      stopStrategyRunner,
      runStrategyCycle,
      runPositionAction,
      testExchange,
      initPaperAccount,
      resetPaperWorkspace,
      submitTrade
    }),
    [snapshot, loading, liveSyncing, lastLiveSyncAt, error]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider.");
  }
  return context;
}
