import type { FastifyInstance } from "fastify";
import type { PositionActionRequest, RiskPolicy, SettingsState, StrategyRunnerConfigRequest, StrategyToggleRequest } from "@prooftrader/shared";
import { stateStore } from "../services/state-store.js";
import { strategyRunnerService } from "../services/strategy-runner.service.js";

export async function actionRoutes(app: FastifyInstance) {
  app.post<{ Body: Partial<SettingsState> }>("/api/settings", async (request) => {
    const snapshot = await stateStore.updateSettings(request.body);
    return { ok: true, message: "Settings saved.", snapshot };
  });

  app.post<{ Body: RiskPolicy }>("/api/risk/policy", async (request) => {
    const snapshot = await stateStore.updateRiskPolicy(request.body);
    return { ok: true, message: "Risk policy updated.", snapshot };
  });

  app.post<{ Body: StrategyToggleRequest }>("/api/strategy/toggle", async (request) => {
    const snapshot = await stateStore.toggleStrategy(request.body.paused);
    return { ok: true, message: request.body.paused ? "Strategy paused." : "Strategy resumed.", snapshot };
  });

  app.post<{ Body: Partial<StrategyRunnerConfigRequest> }>("/api/strategy/config", async (request) => {
    return strategyRunnerService.updateConfig(request.body ?? {});
  });

  app.post<{ Body: { cadenceSeconds?: number } }>("/api/strategy/runner/start", async (request) => {
    return strategyRunnerService.start(request.body?.cadenceSeconds);
  });

  app.post("/api/strategy/runner/stop", async () => strategyRunnerService.stop());

  app.post("/api/strategy/runner/run", async () => strategyRunnerService.runOnce());

  app.post<{ Params: { id: string }; Body: PositionActionRequest }>("/api/positions/:id/action", async (request) => {
    return stateStore.handlePositionAction(request.params.id, request.body);
  });

  app.post("/api/exchange/test", async () => stateStore.testExchange());

  app.post<{ Body: { balance?: number; currency?: string } }>("/api/kraken/paper/init", async (request) => {
    return stateStore.initPaperAccount(request.body?.balance, request.body?.currency);
  });

  app.post("/api/kraken/paper/sync", async () => stateStore.syncPaperAccount());

  app.post<{ Body: { balance?: number; currency?: string } }>("/api/workspace/reset-paper", async (request) => {
    await strategyRunnerService.stop();
    return stateStore.resetPaperWorkspace(request.body?.balance, request.body?.currency);
  });

  app.post<{
    Body: {
      symbol: string;
      side: "LONG" | "SHORT";
      size: number;
      orderType?: "market" | "limit";
      limitPrice?: number;
      stopLoss?: number;
      takeProfit?: number;
      signalSummary?: string;
      strategy?: string;
    };
  }>("/api/trades/execute", async (request, reply) => {
    const result = await stateStore.executeTrade(request.body);
    if (!result.ok) {
      return reply.status(400).send(result);
    }
    return result;
  });
}
