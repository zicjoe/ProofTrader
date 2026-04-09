import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import {
  Target,
  Brain,
  Play,
  Pause,
  CheckCircle,
  RefreshCw,
  Bot,
  Save
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import type { StrategyRunnerConfigRequest } from "@prooftrader/shared";

type RunnerDraft = Required<StrategyRunnerConfigRequest> & { watchedSymbolsText: string };

export function StrategyPage() {
  const {
    snapshot,
    loading,
    error,
    refresh,
    toggleStrategy,
    startStrategyRunner,
    stopStrategyRunner,
    runStrategyCycle,
    saveStrategyRunnerConfig
  } = useAppData();

  const [draft, setDraft] = useState<RunnerDraft | null>(null);
  const lastRunnerSnapshotJsonRef = useRef<string | null>(null);
  const syncDraftFromSnapshotRef = useRef(false);

  useEffect(() => {
    if (!snapshot) return;
    const nextDraft = {
      cadenceSeconds: snapshot.strategy.runner.cadenceSeconds,
      confidenceThreshold: Number((snapshot.strategy.runner.confidenceThreshold * 100).toFixed(0)),
      tradeSizeUsd: snapshot.strategy.runner.tradeSizeUsd,
      maxTradesPerDay: snapshot.strategy.runner.maxTradesPerDay,
      cooldownAfterLosses: snapshot.strategy.runner.cooldownAfterLosses,
      watchedSymbols: snapshot.strategy.runner.watchedSymbols,
      watchedSymbolsText: snapshot.strategy.runner.watchedSymbols.join(", ")
    };
    const nextJson = JSON.stringify(nextDraft);

    setDraft((current) => {
      if (!current || syncDraftFromSnapshotRef.current) {
        syncDraftFromSnapshotRef.current = false;
        return nextDraft;
      }

      const currentJson = JSON.stringify(current);
      const previousSnapshotJson = lastRunnerSnapshotJsonRef.current;
      const isDirtyAgainstPrevious = previousSnapshotJson !== null && currentJson !== previousSnapshotJson;
      const alreadyMatchesNext = currentJson === nextJson;

      if (!isDirtyAgainstPrevious || alreadyMatchesNext) {
        return nextDraft;
      }

      return current;
    });

    lastRunnerSnapshotJsonRef.current = nextJson;
  }, [snapshot]);

  const configDirty = useMemo(() => {
    if (!snapshot || !draft) return false;
    const runner = snapshot.strategy.runner;
    const normalizedSymbols = normalizeSymbols(draft.watchedSymbolsText);
    return (
      draft.cadenceSeconds !== runner.cadenceSeconds ||
      draft.confidenceThreshold !== Number((runner.confidenceThreshold * 100).toFixed(0)) ||
      draft.tradeSizeUsd !== runner.tradeSizeUsd ||
      draft.maxTradesPerDay !== runner.maxTradesPerDay ||
      draft.cooldownAfterLosses !== runner.cooldownAfterLosses ||
      normalizedSymbols.join(",") !== runner.watchedSymbols.join(",")
    );
  }, [snapshot, draft]);

  if (loading && !snapshot) return <PageLoading label="Loading strategy state..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot || !draft) return <PageError message="No strategy snapshot returned." onRetry={() => void refresh()} />;

  const strategy = snapshot.strategy;
  const runner = strategy.runner;
  const accountMode = snapshot.settings.exchange.accountMode;
  const leverageLabel = accountMode === "futures" ? `${snapshot.settings.exchange.futuresLeverage}x` : "1x";
  const futuresThrottle = strategy.ai.futuresThrottle;
  const futuresDefense = strategy.ai.futuresDefense;
  const positionExitEngine = strategy.ai.positionExitEngine;
  const portfolioAllocation = strategy.ai.portfolioAllocation;
  const isFuturesMode = accountMode === "futures";
  const modeLabel = isFuturesMode ? "Futures" : "Spot";

  const handleToggle = async () => {
    try {
      const message = await toggleStrategy(!strategy.paused);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update strategy state.");
    }
  };

  const handleSaveConfig = async () => {
    syncDraftFromSnapshotRef.current = true;
    try {
      const watchedSymbols = normalizeSymbols(draft.watchedSymbolsText);
      if (watchedSymbols.length === 0) {
        syncDraftFromSnapshotRef.current = false;
        toast.error("Add at least one watched symbol.");
        return;
      }

      const message = await saveStrategyRunnerConfig({
        cadenceSeconds: Math.max(10, Math.round(draft.cadenceSeconds)),
        confidenceThreshold: clampPercent(draft.confidenceThreshold) / 100,
        tradeSizeUsd: Math.max(50, draft.tradeSizeUsd),
        maxTradesPerDay: Math.max(1, Math.round(draft.maxTradesPerDay)),
        cooldownAfterLosses: Math.max(1, Math.round(draft.cooldownAfterLosses)),
        watchedSymbols
      });
      toast.success(message);
    } catch (err) {
      syncDraftFromSnapshotRef.current = false;
      toast.error(err instanceof Error ? err.message : "Failed to save strategy runner settings.");
    }
  };

  const handleRunnerStart = async () => {
    try {
      if (configDirty) {
        await handleSaveConfig();
      }
      const message = await startStrategyRunner(Math.max(10, Math.round(draft.cadenceSeconds)));
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start strategy runner.");
    }
  };

  const handleRunnerStop = async () => {
    try {
      const message = await stopStrategyRunner();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop strategy runner.");
    }
  };

  const handleRunCycle = async () => {
    try {
      const message = await runStrategyCycle();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run strategy cycle.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Strategy</h1>
          <p className="text-zinc-400">Operational view of the active strategy, rules, runner health, and AI commentary.</p>
          <div className="mt-2 flex gap-2">
            <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200">{accountMode === "futures" ? `Futures ${leverageLabel}` : "Spot 1x"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => void handleRunCycle()}>
            <RefreshCw className="h-4 w-4" />
            Run Cycle Now
          </Button>
          {runner.enabled ? (
            <Button variant="outline" className="gap-2" onClick={() => void handleRunnerStop()}>
              <Bot className="h-4 w-4" />
              Stop Auto Runner
            </Button>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => void handleRunnerStart()}>
              <Bot className="h-4 w-4" />
              Start Auto Runner
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => void handleToggle()}>
            {strategy.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {strategy.paused ? "Resume Strategy" : "Pause Strategy"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Selected Strategy" value={strategy.selectedStrategy} />
        <StatCard label="Current Mode" value={strategy.currentMode} />
        <StatCard label="Readiness" value={strategy.readiness} />
        <StatCard label="Signals Today" value={String(strategy.signalsToday)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Performance Snapshot</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={strategy.performance}>
                <XAxis dataKey="date" stroke="#71717a" />
                <YAxis stroke="#71717a" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                <Tooltip />
                <Area type="monotone" dataKey="equity" stroke="#34d399" fill="#065f46" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Runner Control Plane</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Surface label="Runner status">
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-medium text-white">{runner.status}</span>
                <Badge className={runner.enabled ? "border-emerald-800 bg-emerald-950 text-emerald-400" : "border-zinc-700 bg-zinc-800 text-zinc-300"}>
                  {runner.enabled ? "Auto trading on" : "Auto trading off"}
                </Badge>
              </div>
            </Surface>
            <Surface label="Cadence">
              <p className="mt-2 break-words text-sm text-zinc-300">{runner.cadenceSeconds}s scan interval</p>
            </Surface>
            <Surface label="Watched symbols">
              <p className="mt-2 break-words text-sm text-zinc-300">{runner.watchedSymbols.join(", ")}</p>
            </Surface>
            <Surface label="Latest summary">
              <p className="mt-2 break-words text-sm text-zinc-300">{runner.latestSummary}</p>
            </Surface>
            <div className="grid gap-3 md:grid-cols-2">
              <Surface label="Confidence threshold">
                <p className="mt-2 break-words text-sm text-zinc-300">{Math.round(runner.confidenceThreshold * 100)}%</p>
              </Surface>
              <Surface label="Trade size per signal">
                <p className="mt-2 break-words text-sm text-zinc-300">${runner.tradeSizeUsd.toFixed(2)}</p>
              </Surface>
              <Surface label="Max auto trades / day">
                <p className="mt-2 break-words text-sm text-zinc-300">{runner.maxTradesPerDay}</p>
              </Surface>
              <Surface label="Cooldown after losses">
                <p className="mt-2 break-words text-sm text-zinc-300">{runner.cooldownAfterLosses}</p>
              </Surface>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Runner Settings</CardTitle>
            <Button className="gap-2" onClick={() => void handleSaveConfig()} disabled={!configDirty}>
              <Save className="h-4 w-4" />
              Save Runner Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <Field label="Watched symbols">
            <Input
              value={draft.watchedSymbolsText}
              onChange={(event) => setDraft((current) => current ? { ...current, watchedSymbolsText: event.target.value } : current)}
              className="border-zinc-700 bg-zinc-800 text-white"
              placeholder="BTC/USD, ETH/USD, SOL/USD"
            />
            <p className="text-xs text-zinc-500">Comma-separated. These symbols are saved and used by the auto runner.</p>
          </Field>

          <Field label="Scan interval (seconds)">
            <Input
              type="number"
              min={10}
              value={draft.cadenceSeconds}
              onChange={(event) => setDraft((current) => current ? { ...current, cadenceSeconds: Number(event.target.value) } : current)}
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </Field>

          <Field label="Confidence threshold (%)">
            <Input
              type="number"
              min={50}
              max={95}
              value={draft.confidenceThreshold}
              onChange={(event) => setDraft((current) => current ? { ...current, confidenceThreshold: Number(event.target.value) } : current)}
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </Field>

          <Field label="Trade size per signal (USD)">
            <Input
              type="number"
              min={50}
              step="50"
              value={draft.tradeSizeUsd}
              onChange={(event) => setDraft((current) => current ? { ...current, tradeSizeUsd: Number(event.target.value) } : current)}
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </Field>

          <Field label="Max auto trades per day">
            <Input
              type="number"
              min={1}
              value={draft.maxTradesPerDay}
              onChange={(event) => setDraft((current) => current ? { ...current, maxTradesPerDay: Number(event.target.value) } : current)}
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </Field>

          <Field label="Cooldown after consecutive losses">
            <Input
              type="number"
              min={1}
              value={draft.cooldownAfterLosses}
              onChange={(event) => setDraft((current) => current ? { ...current, cooldownAfterLosses: Number(event.target.value) } : current)}
              className="border-zinc-700 bg-zinc-800 text-white"
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader><CardTitle>AI Decision Engine</CardTitle></CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            <Surface label="AI status">
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-medium text-white">{strategy.ai.status}</span>
                <Badge className={strategy.ai.provider === "llm" ? "border-violet-800 bg-violet-950 text-violet-300" : "border-zinc-700 bg-zinc-800 text-zinc-300"}>
                  {strategy.ai.provider === "llm" ? "Live model" : "Fallback"}
                </Badge>
              </div>
            </Surface>
            <Surface label="Model">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.model}</p>
            </Surface>
            <Surface label="Recommendation">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.recommendedSymbol ? `${strategy.ai.recommendedSymbol} ${strategy.ai.recommendedAction}` : "HOLD"}</p>
            </Surface>
            <Surface label="Strategy module">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.strategyModule ?? "Observation"}</p>
            </Surface>
            <Surface label="Execution bias">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.executionBias ?? "Balanced"}</p>
            </Surface>
            <Surface label="AI confidence">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.confidence != null ? `${Math.round(strategy.ai.confidence * 100)}%` : "No score"}</p>
            </Surface>
            <Surface label="Size multiplier">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.sizeMultiplier != null ? `${strategy.ai.sizeMultiplier.toFixed(2)}x` : "—"}</p>
            </Surface>
            <Surface label="Stop loss envelope">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.stopLossPercent != null ? `${strategy.ai.stopLossPercent.toFixed(2)}%` : "—"}</p>
            </Surface>
            <Surface label="Take profit envelope">
              <p className="mt-2 break-words text-sm text-zinc-300">{strategy.ai.takeProfitPercent != null ? `${strategy.ai.takeProfitPercent.toFixed(2)}%` : "—"}</p>
            </Surface>
            {isFuturesMode && (
              <>
                <Surface label="Futures throttle posture">
                  <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-medium text-white">{futuresThrottle?.posture ?? "Normal"}</span>
                    <Badge className={
                      !futuresThrottle || futuresThrottle.posture === "Normal"
                        ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                        : futuresThrottle.posture === "Guarded"
                          ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                          : futuresThrottle.posture === "Tight"
                            ? "border-amber-800 bg-amber-950 text-amber-300"
                            : "border-red-800 bg-red-950 text-red-300"
                    }>
                      {futuresThrottle?.blockNewEntries ? "Blocking new entries" : futuresThrottle && futuresThrottle.posture !== "Normal" ? "Throttle active" : "Normal envelope"}
                    </Badge>
                  </div>
                </Surface>
                <Surface label="Futures effective gate">
                  <p className="mt-2 break-words text-sm text-zinc-300">
                    {futuresThrottle ? `${Math.round(futuresThrottle.adjustedConfidenceThreshold * 100)}% confidence · ${futuresThrottle.adjustedMaxTradesPerDay} trades/day` : `${Math.round(runner.confidenceThreshold * 100)}% confidence · ${runner.maxTradesPerDay} trades/day`}
                  </p>
                </Surface>
                <Surface label="Futures size and leverage">
                  <p className="mt-2 break-words text-sm text-zinc-300">
                    {futuresThrottle ? `$${futuresThrottle.adjustedTradeSizeUsd.toFixed(2)} target size · ${Math.round(futuresThrottle.sizeFactor * 100)}% factor · ${futuresThrottle.leverageCap}x cap` : "Normal futures envelope"}
                  </p>
                </Surface>
                <Surface label="Futures defense status">
                  <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-medium text-white">{futuresDefense?.status ?? "Idle"}</span>
                    <Badge className={
                      !futuresDefense || futuresDefense.action === "HOLD"
                        ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                        : futuresDefense.action === "CLOSE"
                          ? "border-red-800 bg-red-950 text-red-300"
                          : "border-amber-800 bg-amber-950 text-amber-300"
                    }>
                      {futuresDefense?.action === "CLOSE"
                        ? "Forced close ready"
                        : futuresDefense && futuresDefense.action !== "HOLD"
                          ? "Protective reduce ready"
                          : "Monitoring only"}
                    </Badge>
                  </div>
                </Surface>
              </>
            )}
            <Surface label={`${modeLabel} portfolio allocation`}>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-white">{portfolioAllocation?.status ?? "Idle"}</span>
                <Badge className={
                  !portfolioAllocation || portfolioAllocation.status === "Idle"
                    ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                    : portfolioAllocation.status === "Blocked"
                      ? "border-red-800 bg-red-950 text-red-300"
                      : portfolioAllocation.status === "Constrained"
                        ? "border-amber-800 bg-amber-950 text-amber-300"
                        : "border-emerald-800 bg-emerald-950 text-emerald-300"
                }>
                  {portfolioAllocation?.status === "Blocked"
                    ? "Entry blocked"
                    : portfolioAllocation?.status === "Constrained"
                      ? "Size taper active"
                      : portfolioAllocation?.status === "Sizing"
                        ? "Portfolio aware"
                        : "Monitoring only"}
                </Badge>
              </div>
            </Surface>
            <Surface label="Auto exit engine">
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-white">{positionExitEngine?.status ?? "Idle"}</span>
                <Badge className={
                  !positionExitEngine || positionExitEngine.action === "HOLD"
                    ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                    : positionExitEngine.action === "STOP_LOSS_CLOSE" || positionExitEngine.action === "MIXED_CLOSE"
                      ? "border-red-800 bg-red-950 text-red-300"
                      : "border-emerald-800 bg-emerald-950 text-emerald-300"
                }>
                  {positionExitEngine?.action === "STOP_LOSS_CLOSE"
                    ? "Stop close ready"
                    : positionExitEngine?.action === "TAKE_PROFIT_CLOSE"
                      ? "Profit lock ready"
                      : positionExitEngine?.action === "MIXED_CLOSE"
                        ? "Mixed exits ready"
                        : "Monitoring only"}
                </Badge>
              </div>
            </Surface>
          </div>
          <div className="space-y-3">
            <Surface label="Rationale">
              <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{strategy.ai.rationale}</p>
            </Surface>
            <Surface label="Risk note">
              <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{strategy.ai.riskNote}</p>
            </Surface>
            {isFuturesMode && futuresThrottle && (
              <Surface label="Futures throttle summary">
                <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{futuresThrottle.summary}</p>
                {futuresThrottle.reasons.length > 0 && (
                  <p className="mt-2 break-words text-xs leading-5 text-zinc-400">{futuresThrottle.reasons.join(" ")}</p>
                )}
                <p className="mt-2 break-words text-xs text-zinc-500">
                  Score {futuresThrottle.score} · Daily loss {Math.round(futuresThrottle.dailyLossUtilization * 100)}% · Drawdown {Math.round(futuresThrottle.drawdownUtilization * 100)}% · Exposure {Math.round(futuresThrottle.exposureUtilization * 100)}%
                  {futuresThrottle.minLiquidationBufferPercent != null ? ` · Min liquidation buffer ${futuresThrottle.minLiquidationBufferPercent.toFixed(2)}%` : ""}
                </p>
              </Surface>
            )}
            {isFuturesMode && futuresDefense && (
              <Surface label="Futures defense summary">
                <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{futuresDefense.summary}</p>
                {futuresDefense.reasons.length > 0 && (
                  <p className="mt-2 break-words text-xs leading-5 text-zinc-400">{futuresDefense.reasons.join(" ")}</p>
                )}
                <p className="mt-2 break-words text-xs text-zinc-500">
                  {futuresDefense.targetSymbol ?? "No target"}
                  {futuresDefense.liveLiquidationBufferPercent != null ? ` · Live buffer ${futuresDefense.liveLiquidationBufferPercent.toFixed(2)}%` : ""}
                  {futuresDefense.lossOnCollateralPercent != null ? ` · Loss on collateral ${futuresDefense.lossOnCollateralPercent.toFixed(2)}%` : ""}
                  {futuresDefense.unrealizedPnL != null ? ` · Unrealized $${futuresDefense.unrealizedPnL.toFixed(2)}` : ""}
                  {futuresDefense.appliedAt ? ` · Applied ${futuresDefense.appliedAt}` : ""}
                </p>
              </Surface>
            )}
            {portfolioAllocation && (
              <Surface label={`${modeLabel} portfolio allocation summary`}>
                <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{portfolioAllocation.summary}</p>
                {portfolioAllocation.reasons.length > 0 && (
                  <p className="mt-2 break-words text-xs leading-5 text-zinc-400">{portfolioAllocation.reasons.join(" ")}</p>
                )}
                <p className="mt-2 break-words text-xs text-zinc-500">
                  {portfolioAllocation.targetSymbol ?? "No target"}
                  {portfolioAllocation.targetBucket ? ` · ${portfolioAllocation.targetBucket}` : ""}
                  {portfolioAllocation.targetSide ? ` · ${portfolioAllocation.targetSide.toLowerCase()}` : ""}
                  {` · ${Math.round(portfolioAllocation.recommendedSizeMultiplier * 100)}% size`}
                  {portfolioAllocation.effectiveTradeSizeUsd > 0 ? ` · $${portfolioAllocation.effectiveTradeSizeUsd.toFixed(2)} base` : ""}
                  {portfolioAllocation.leverageCap != null ? ` · ${portfolioAllocation.leverageCap}x cap` : ""}
                  {` · Mode ${Math.round(portfolioAllocation.modeExposureUtilization * 100)}%`}
                  {portfolioAllocation.bucketExposureUtilization > 0 ? ` · Bucket ${Math.round(portfolioAllocation.bucketExposureUtilization * 100)}%` : ""}
                  {portfolioAllocation.sideExposureUtilization > 0 ? ` · Side ${Math.round(portfolioAllocation.sideExposureUtilization * 100)}%` : ""}
                  {` · Heat ${Math.round(portfolioAllocation.portfolioHeat * 100)}%`}
                </p>
              </Surface>
            )}
            {positionExitEngine && (
              <Surface label="Auto exit summary">
                <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{positionExitEngine.summary}</p>
                {positionExitEngine.reasons.length > 0 && (
                  <p className="mt-2 break-words text-xs leading-5 text-zinc-400">{positionExitEngine.reasons.join(" ")}</p>
                )}
                <p className="mt-2 break-words text-xs text-zinc-500">
                  {positionExitEngine.targetSymbol ?? "No target"}
                  {positionExitEngine.targetAccountMode ? ` · ${positionExitEngine.targetAccountMode}` : ""}
                  {positionExitEngine.stopTriggeredCount > 0 ? ` · ${positionExitEngine.stopTriggeredCount} stop` : ""}
                  {positionExitEngine.takeProfitTriggeredCount > 0 ? ` · ${positionExitEngine.takeProfitTriggeredCount} take` : ""}
                  {positionExitEngine.lastExitPrice != null ? ` · Last exit $${positionExitEngine.lastExitPrice.toFixed(2)}` : ""}
                  {positionExitEngine.lastRealizedPnL != null ? ` · Realized $${positionExitEngine.lastRealizedPnL.toFixed(2)}` : ""}
                  {positionExitEngine.appliedAt ? ` · Applied ${positionExitEngine.appliedAt}` : ""}
                </p>
              </Surface>
            )}
            {strategy.ai.rankingSummary && (
              <Surface label="Ranking summary">
                <p className="mt-2 break-words text-sm leading-6 text-zinc-300">{strategy.ai.rankingSummary}</p>
              </Surface>
            )}
            {strategy.ai.error && (
              <Surface label="Last AI error">
                <p className="mt-2 text-sm leading-6 text-amber-300">{strategy.ai.error}</p>
              </Surface>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Last runner scan" value={runner.lastRunAt ?? "Not run yet"} compact />
        <StatCard label="Last signal" value={runner.lastSignalAt ?? "No signal yet"} compact />
        <StatCard label="Last auto trade" value={runner.lastTradeAt ?? "No auto trade yet"} compact />
        <StatCard label="Runner market regime" value={strategy.marketRegime} compact />
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader><CardTitle>Execution Policy</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Surface label="Market regime">
            <div className="mt-2 flex items-center justify-between">
              <span className="font-medium text-white">{strategy.marketRegime}</span>
              <Badge className="border-blue-800 bg-blue-950 text-blue-400">{strategy.readiness}</Badge>
            </div>
          </Surface>
          <Surface label="Execution policy">
            <p className="mt-2 break-words text-sm text-zinc-300">{strategy.executionPolicy}</p>
          </Surface>
          <Surface label="Position sizing">
            <p className="mt-2 break-words text-sm text-zinc-300">{strategy.positionSizing}</p>
          </Surface>
          <Surface label="Allowed symbols">
            <p className="mt-2 break-words text-sm text-zinc-300">{strategy.allowedSymbols.join(", ")}</p>
          </Surface>
        </CardContent>
      </Card>

      <Tabs defaultValue="commentary" className="space-y-6">
        <TabsList className="border border-zinc-800 bg-zinc-900">
          <TabsTrigger value="commentary">AI Commentary</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="events">Event History</TabsTrigger>
        </TabsList>

        <TabsContent value="commentary">
          <div className="grid gap-6 xl:grid-cols-2">
            {strategy.aiCommentary.map((item) => (
              <Card key={`${item.label}-${item.timestamp}`} className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4 text-violet-400" />{item.label}</CardTitle>
                    <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300">{item.timestamp}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-zinc-300">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader><CardTitle>Entry Rules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {strategy.entryRules.map((rule) => (
                  <div key={rule} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-green-500" />
                    <span className="text-sm text-zinc-300">{rule}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader><CardTitle>Exit Rules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {strategy.exitRules.map((rule) => (
                  <div key={rule} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <Target className="mt-0.5 h-4 w-4 text-blue-500" />
                    <span className="text-sm text-zinc-300">{rule}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900 xl:col-span-2">
              <CardHeader><CardTitle>Market Conditions</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {Object.entries(strategy.marketConditions).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-sm text-zinc-500">{label}</div>
                    <div className="mt-2 text-lg font-semibold text-white">{String(value)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader><CardTitle>Strategy Event History</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead>Type</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {strategy.eventHistory.map((event) => (
                      <TableRow key={event.id} className="border-zinc-800">
                        <TableCell className="text-zinc-300">{event.type}</TableCell>
                        <TableCell className="font-medium text-white">{event.symbol}</TableCell>
                        <TableCell className="text-zinc-300">{event.action}</TableCell>
                        <TableCell className="text-zinc-300">{event.confidence != null ? `${Math.round(event.confidence * 100)}%` : "—"}</TableCell>
                        <TableCell className="text-zinc-300">{event.outcome}</TableCell>
                        <TableCell className="text-zinc-400">{event.timestamp}</TableCell>
                      </TableRow>
                    ))}
                    {strategy.eventHistory.length === 0 && (
                      <TableRow className="border-zinc-800">
                        <TableCell colSpan={6} className="py-6 text-center text-zinc-500">No strategy events yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function normalizeSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function clampPercent(value: number) {
  return Math.min(95, Math.max(50, Number.isFinite(value) ? value : 68));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      {children}
    </div>
  );
}

function Surface({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="break-words text-sm text-zinc-500">{label}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardContent className="p-6">
        <div className="mb-2 text-sm text-zinc-400">{label}</div>
        <div className={compact ? "break-words text-base font-semibold text-white" : "break-words text-2xl font-bold text-white"}>{value}</div>
      </CardContent>
    </Card>
  );
}
