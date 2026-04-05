import type { StrategyRunnerConfigRequest } from "@prooftrader/shared";
import { stateStore } from "./state-store.js";

class StrategyRunnerService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private cycleInFlight = false;

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(cadenceSeconds: number) {
    this.clearTimer();
    this.timer = setInterval(() => {
      void this.runCycle("interval");
    }, cadenceSeconds * 1000);
  }

  async bootstrap() {
    const snapshot = await stateStore.getSnapshot(false);
    const cadence = snapshot.strategy.runner.cadenceSeconds;

    if (snapshot.strategy.runner.enabled) {
      this.schedule(cadence);
      await stateStore.setStrategyRunnerEnabled(true, cadence);
    } else {
      this.clearTimer();
    }
  }

  async start(cadenceSeconds?: number) {
    const snapshot = await stateStore.setStrategyRunnerEnabled(true, cadenceSeconds);
    this.schedule(snapshot.strategy.runner.cadenceSeconds);
    return this.runCycle("manual", `Strategy runner started on a ${snapshot.strategy.runner.cadenceSeconds}s cadence.`);
  }

  async updateConfig(input: Partial<StrategyRunnerConfigRequest>) {
    const snapshot = await stateStore.updateStrategyRunnerConfig(input);
    if (snapshot.strategy.runner.enabled) {
      this.schedule(snapshot.strategy.runner.cadenceSeconds);
    } else {
      this.clearTimer();
    }
    return {
      ok: true,
      message: "Strategy runner settings saved.",
      snapshot
    };
  }

  async stop() {
    this.clearTimer();
    const snapshot = await stateStore.setStrategyRunnerEnabled(false);
    return {
      ok: true,
      message: "Strategy runner stopped.",
      snapshot
    };
  }

  async runOnce() {
    return this.runCycle("manual");
  }

  private async runCycle(trigger: "manual" | "interval" | "bootstrap", prefix?: string) {
    if (this.cycleInFlight) {
      const snapshot = await stateStore.getSnapshot(false);
      return {
        ok: false,
        message: "Strategy runner is already processing a cycle.",
        snapshot
      };
    }

    this.cycleInFlight = true;
    try {
      const result = await stateStore.runStrategyCycle(trigger);
      return {
        ...result,
        message: prefix ? `${prefix} ${result.message}` : result.message
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown strategy runner error.";
      const snapshot = await stateStore.markStrategyRunnerError(message);
      return {
        ok: false,
        message: `Strategy runner failed: ${message}`,
        snapshot
      };
    } finally {
      this.cycleInFlight = false;
    }
  }
}

export const strategyRunnerService = new StrategyRunnerService();
