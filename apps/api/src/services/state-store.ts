import type {
  ExchangeAccountMode,
  JobStatus,
  LogRecord,
  ModeAttributionSnapshot,
  StrategyFuturesDefenseState,
  StrategyFuturesThrottleState,
  StrategyPositionExitEngineState,
  StrategyPortfolioAllocationState,
  PositionActionRequest,
  PositionRecord,
  ProofTraderSnapshot,
  RiskPolicy,
  SettingsState,
  StrategyRunnerConfigRequest,
  TradeRecord
} from "@prooftrader/shared";
import { seedSnapshot } from "@prooftrader/shared";
import { prisma } from "../lib/prisma.js";
import { Prisma, prisma } from "../../generated/prisma/client.js";
import { buildValidationRequestPayload } from "./erc8004.service.js";
import { krakenCliService } from "./kraken-cli.service.js";
import type { DepthMetrics, OhlcCandle } from "./kraken-cli.service.js";
import { aiDecisionService } from "./ai-decision.service.js";

type ExecuteTradeRequest = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  orderType?: "market" | "limit";
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  signalSummary?: string;
  strategy?: string;
  accountMode?: ExchangeAccountMode;
  leverage?: number;
  liquidationPrice?: number | null;
  liquidationDistancePercent?: number | null;
};

type StrategyCandidate = {
  id: string;
  symbol: string;
  price: number;
  action: "LONG" | "SHORT";
  confidence: number;
  type: string;
  module: string;
  regime: string;
  summary: string;
  momentumPercent: number;
  mediumMomentumPercent: number;
  spreadPercent: number;
  volatilityPercent: number;
  rangePosition: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  sizeMultiplier: number;
  expectedHoldMinutes: number;
  atrPercent: number;
  trend1hPercent: number;
  trend15mPercent: number;
  spreadBps: number;
  bookImbalance: number;
  liquidityUsd: number;
  executionQuality: number;
};

type StrategyObservation = {
  action: "LONG" | "SHORT" | "HOLD";
  type: string;
  confidence: number;
  summary: string;
  regime: string;
  spreadPercent: number;
  momentumPercent: number;
  candidateCount: number;
  executionQuality?: number;
  atrPercent?: number;
};

type MarketContext = {
  symbol: string;
  price: number;
  atr5mPercent: number;
  atr15mPercent: number;
  atr1hPercent: number;
  trend15mPercent: number;
  trend1hPercent: number;
  momentum5mPercent: number;
  mediumMomentumPercent: number;
  realizedVolatilityPercent: number;
  rangePosition5m: number;
  rangePosition15m: number;
  breakoutPressure: number;
  meanReversionStretch: number;
  regime: string;
  executionQuality: number;
  liquidityUsd: number;
  spreadPercent: number;
  spreadBps: number;
  bookImbalance: number;
  topLevelLiquidityUsd: number;
  candles5m: OhlcCandle[];
  candles15m: OhlcCandle[];
  candles1h: OhlcCandle[];
};

type AppMessage = { ok: boolean; message: string };

type FuturesDefenseAction = "HOLD" | "REDUCE_25" | "REDUCE_50" | "CLOSE";

type FuturesDefensePlan = StrategyFuturesDefenseState & {
  action: FuturesDefenseAction;
  score: number;
  targetReduceFraction: number | null;
};

type PositionExitAction = "HOLD" | "STOP_LOSS_CLOSE" | "TAKE_PROFIT_CLOSE" | "MIXED_CLOSE";

type PositionExitTarget = {
  positionId: string;
  symbol: string;
  accountMode: ExchangeAccountMode;
  side: "LONG" | "SHORT";
  trigger: "stop_loss" | "take_profit";
  currentPrice: number;
  unrealizedPnL: number;
};

type PositionExitPlan = StrategyPositionExitEngineState & {
  targets: PositionExitTarget[];
};

type PortfolioContextSummary = {
  mode: ExchangeAccountMode;
  modeExposureUtilization: number;
  portfolioHeat: number;
  openPositionsInMode: number;
  dominantSide: "LONG" | "SHORT" | "BALANCED";
  crowdedBuckets: string[];
  summary: string;
  reasons: string[];
};

type PortfolioAllocationPlan = StrategyPortfolioAllocationState & {
  blockNewEntries: boolean;
};

type PositionAdjustmentInput = {
  action: "reduce" | "close";
  reduceFraction?: number;
  signalSummary: string;
  riskSummary: string;
  strategyLabel?: string;
  jobType: string;
  logStream: "execution" | "risk";
  logLevel: LogRecord["level"];
  logMessage: string;
  successMessage: string;
  meta?: Record<string, unknown>;
};

const DEFAULT_WORKSPACE_SLUG = "default";
const FEE_RATE = 0.0026;

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().replace("T", " ").replace(".000Z", "") : null;
}

function sameDay(date: Date, reference = new Date()) {
  return date.getUTCFullYear() === reference.getUTCFullYear() && date.getUTCMonth() === reference.getUTCMonth() && date.getUTCDate() === reference.getUTCDate();
}

function withinDays(date: Date, days: number, reference = new Date()) {
  return reference.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function directionMultiplier(side: "LONG" | "SHORT") {
  return side === "LONG" ? 1 : -1;
}

function round(value: number, places = 2) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function accountModeLabel(mode: ExchangeAccountMode) {
  return mode === "futures" ? "Futures" : "Spot";
}

function accountLeverage(mode: ExchangeAccountMode, leverage: number) {
  return mode === "futures" ? Math.max(leverage, 1) : 1;
}

function correlatedBucket(symbol: string) {
  const normalized = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (["BTCUSD", "XBTUSD", "ETHUSD", "SOLUSD"].includes(normalized)) return "majors";
  if (normalized.endsWith("USD")) return "usd-spot";
  return normalized;
}

function strategyImpliesFutures(strategy?: string | null) {
  return String(strategy ?? "").toLowerCase().includes("futures");
}

function inferTradeAccountMode(trade: { strategy?: string | null }): ExchangeAccountMode {
  return strategyImpliesFutures(trade.strategy) ? "futures" : "spot";
}

function inferPositionAccountMode(position: { liquidationPrice?: number | null; leverage?: number; strategy?: string | null }): ExchangeAccountMode {
  if (position.liquidationPrice != null || (position.leverage ?? 1) > 1) {
    return "futures";
  }
  return strategyImpliesFutures(position.strategy) ? "futures" : "spot";
}

function futuresMaintenanceMarginPercent(leverage: number) {
  return clamp(0.55 + Math.max(leverage - 1, 0) * 0.15, 0.55, 1.4);
}

function calculateLiquidationPrice(entryPrice: number, side: "LONG" | "SHORT", leverage: number, mode: ExchangeAccountMode) {
  if (mode !== "futures" || entryPrice <= 0) return null;
  const liqDistancePercent = Math.max((100 / Math.max(leverage, 1)) - futuresMaintenanceMarginPercent(leverage), 1.5) / 100;
  return round(entryPrice * (side === "LONG" ? 1 - liqDistancePercent : 1 + liqDistancePercent), 2);
}

function calculateLiquidationDistancePercent(entryPrice: number, liquidationPrice: number | null | undefined) {
  if (!liquidationPrice || entryPrice <= 0) return null;
  return round((Math.abs(entryPrice - liquidationPrice) / entryPrice) * 100, 2);
}

function calculateLiveLiquidationBufferPercent(currentPrice: number, liquidationPrice: number | null | undefined) {
  if (!liquidationPrice || currentPrice <= 0) return null;
  return round((Math.abs(currentPrice - liquidationPrice) / currentPrice) * 100, 2);
}

function isStopLossTriggered(position: PositionRecord) {
  if (!Number.isFinite(position.stopLoss) || position.stopLoss <= 0) return false;
  return position.side === "LONG" ? position.currentPrice <= position.stopLoss : position.currentPrice >= position.stopLoss;
}

function isTakeProfitTriggered(position: PositionRecord) {
  if (!Number.isFinite(position.takeProfit) || position.takeProfit <= 0) return false;
  return position.side === "LONG" ? position.currentPrice >= position.takeProfit : position.currentPrice <= position.takeProfit;
}

function currentDrawdownPercent(snapshot: ProofTraderSnapshot) {
  return Math.abs(Math.min(snapshot.dashboard.maxDrawdown, 0));
}

function extractLeverageFromStrategy(strategy?: string | null) {
  const match = String(strategy ?? "").match(/(\d+(?:\.\d+)?)x/i);
  const leverage = match ? Number(match[1]) : NaN;
  return Number.isFinite(leverage) ? Math.max(leverage, 1) : null;
}

function tradeEffectiveLeverage(trade: { accountMode: ExchangeAccountMode; strategy?: string | null }) {
  const parsed = extractLeverageFromStrategy(trade.strategy);
  return trade.accountMode === "futures" ? Math.max(parsed ?? 1, 1) : 1;
}

function tradeCapitalUsedUsd(trade: { accountMode: ExchangeAccountMode; entryPrice: number; size: number; strategy?: string | null }) {
  const notional = Math.abs(trade.entryPrice * trade.size);
  return round(trade.accountMode === "futures" ? notional / Math.max(tradeEffectiveLeverage(trade), 1) : notional, 2);
}

function positionOpenNotionalUsd(position: PositionRecord) {
  return round(Math.abs(position.currentPrice * position.size), 2);
}

function modeExposureCap(snapshot: ProofTraderSnapshot, mode: ExchangeAccountMode) {
  const equityCard = snapshot.dashboard.metricCards.find((card) => card.label === "Total Equity");
  const totalEquity = Math.max(snapshot.paper.equity, equityCard?.value ?? 0, snapshot.paper.balance, 1);
  return mode === "futures"
    ? Math.max(snapshot.risk.policy.futuresMaxOpenNotionalUsd, 1)
    : Math.max(snapshot.risk.policy.maxPositionSizeUsd * Math.max(snapshot.risk.policy.maxConcurrentPositions, 1), totalEquity * 0.95, snapshot.risk.policy.maxPositionSizeUsd);
}

function bucketExposureCap(snapshot: ProofTraderSnapshot, mode: ExchangeAccountMode) {
  const modeCap = modeExposureCap(snapshot, mode);
  return mode === "futures"
    ? Math.min(modeCap, Math.max(snapshot.risk.policy.futuresMaxPositionNotionalUsd * 1.2, modeCap * 0.42))
    : Math.min(modeCap, Math.max(snapshot.risk.policy.maxPositionSizeUsd * 1.75, modeCap * 0.45));
}

function buildPortfolioContext(snapshot: ProofTraderSnapshot, mode: ExchangeAccountMode, attributionByMode?: Record<ExchangeAccountMode, ModeAttributionSnapshot>): PortfolioContextSummary {
  const modePositions = snapshot.positions.filter((position) => position.accountMode === mode);
  const longNotional = round(modePositions.filter((position) => position.side === "LONG").reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2);
  const shortNotional = round(modePositions.filter((position) => position.side === "SHORT").reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2);
  const dominantSide = longNotional === shortNotional
    ? "BALANCED"
    : longNotional > shortNotional
      ? "LONG"
      : "SHORT";
  const exposureUtilization = round((attributionByMode?.[mode].openNotionalUsd ?? modePositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0)) / Math.max(modeExposureCap(snapshot, mode), 1), 2);
  const positionUtilization = round(modePositions.length / Math.max(snapshot.risk.policy.maxConcurrentPositions, 1), 2);
  const drawdownCap = mode === "futures" ? snapshot.risk.policy.futuresMaxDrawdownPercent : snapshot.risk.policy.maxWeeklyDrawdownPercent;
  const drawdownUtilization = round(currentDrawdownPercent(snapshot) / Math.max(drawdownCap, 0.01), 2);
  const crowdedBuckets = Array.from(new Set(modePositions
    .map((position) => correlatedBucket(position.symbol))
    .filter((bucket) => {
      const bucketPositions = modePositions.filter((position) => correlatedBucket(position.symbol) === bucket);
      const bucketUtilization = round(bucketPositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0) / Math.max(bucketExposureCap(snapshot, mode), 1), 2);
      return bucketUtilization >= 0.45 || bucketPositions.length >= 2;
    })));
  const portfolioHeat = round(clamp((exposureUtilization * 0.5) + (positionUtilization * 0.2) + (drawdownUtilization * 0.2) + (crowdedBuckets.length > 0 ? 0.1 : 0), 0, 1.5), 2);
  const reasons = [
    exposureUtilization >= 0.65 ? `${accountModeLabel(mode)} open exposure is already using ${Math.round(exposureUtilization * 100)}% of its working capacity.` : null,
    crowdedBuckets.length > 0 ? `Crowded buckets: ${crowdedBuckets.join(", ")}.` : null,
    dominantSide !== "BALANCED" ? `${accountModeLabel(mode)} book is currently skewed ${dominantSide.toLowerCase()}.` : null
  ].filter((value): value is string => Boolean(value));
  const summary = reasons.length > 0
    ? `Portfolio context is active for ${accountModeLabel(mode).toLowerCase()} sizing. ${reasons.join(" ")}`
    : `${accountModeLabel(mode)} book is balanced enough for normal ticket sizing.`;

  return {
    mode,
    modeExposureUtilization: exposureUtilization,
    portfolioHeat,
    openPositionsInMode: modePositions.length,
    dominantSide,
    crowdedBuckets,
    summary,
    reasons
  };
}

function buildPortfolioAllocationPlan(
  snapshot: ProofTraderSnapshot,
  target: { symbol: string; side: "LONG" | "SHORT"; accountMode: ExchangeAccountMode },
  attributionByMode?: Record<ExchangeAccountMode, ModeAttributionSnapshot>
): PortfolioAllocationPlan {
  const mode = target.accountMode;
  const modePositions = snapshot.positions.filter((position) => position.accountMode === mode);
  const bucket = correlatedBucket(target.symbol);
  const bucketPositions = modePositions.filter((position) => correlatedBucket(position.symbol) === bucket);
  const sameSideModePositions = modePositions.filter((position) => position.side === target.side);
  const oppositeSideModePositions = modePositions.filter((position) => position.side !== target.side);
  const modeOpenNotional = attributionByMode?.[mode].openNotionalUsd ?? round(modePositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2);
  const bucketOpenNotional = round(bucketPositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2);
  const sameSideOpenNotional = round(sameSideModePositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2);
  const oppositeSideOpenNotional = round(oppositeSideModePositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2);
  const modeUtilization = round(modeOpenNotional / Math.max(modeExposureCap(snapshot, mode), 1), 2);
  const bucketUtilization = round(bucketOpenNotional / Math.max(bucketExposureCap(snapshot, mode), 1), 2);
  const sideExposureCap = modeExposureCap(snapshot, mode) * (mode === "futures" ? 0.7 : 0.75);
  const sideUtilization = round(sameSideOpenNotional / Math.max(sideExposureCap, 1), 2);
  const context = buildPortfolioContext(snapshot, mode, attributionByMode);
  const sameSideDominant = sameSideOpenNotional >= oppositeSideOpenNotional && sameSideOpenNotional > 0;
  let sizeFactor = 1;
  const reasons: string[] = [];

  const addReason = (reason: string) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (modeUtilization >= 0.85) {
    sizeFactor *= 0.6;
    addReason(`${accountModeLabel(mode)} exposure is already heavy at ${Math.round(modeUtilization * 100)}% of the live cap.`);
  } else if (modeUtilization >= 0.65) {
    sizeFactor *= 0.75;
    addReason(`${accountModeLabel(mode)} exposure is elevated at ${Math.round(modeUtilization * 100)}% of the live cap.`);
  } else if (modeUtilization >= 0.45) {
    sizeFactor *= 0.88;
    addReason(`${accountModeLabel(mode)} exposure is no longer light at ${Math.round(modeUtilization * 100)}% of the live cap.`);
  }

  if (bucketPositions.length >= 2 || bucketUtilization >= 0.75) {
    sizeFactor *= 0.74;
    addReason(`${bucket} bucket is already crowded with ${bucketPositions.length} open position${bucketPositions.length === 1 ? "" : "s"}.`);
  } else if (bucketUtilization >= 0.5) {
    sizeFactor *= 0.86;
    addReason(`${bucket} bucket exposure is already warm at ${Math.round(bucketUtilization * 100)}% of its working allowance.`);
  }

  if (sameSideDominant && sideUtilization >= 0.85) {
    sizeFactor *= 0.76;
    addReason(`Current ${accountModeLabel(mode).toLowerCase()} book is already leaning ${target.side.toLowerCase()} with ${Math.round(sideUtilization * 100)}% same-side utilization.`);
  } else if (sameSideDominant && sideUtilization >= 0.65) {
    sizeFactor *= 0.88;
    addReason(`Same-side ${target.side.toLowerCase()} exposure is already building in ${accountModeLabel(mode).toLowerCase()} mode.`);
  } else if (!sameSideDominant && oppositeSideOpenNotional > 0) {
    addReason(`${target.side} would diversify a currently ${context.dominantSide.toLowerCase()}-skewed ${accountModeLabel(mode).toLowerCase()} book.`);
  }

  if (context.portfolioHeat >= 0.85) {
    sizeFactor *= 0.8;
    addReason(`Portfolio heat is elevated at ${Math.round(context.portfolioHeat * 100)}%.`);
  } else if (context.portfolioHeat >= 0.65) {
    sizeFactor *= 0.9;
    addReason(`Portfolio heat is warming up at ${Math.round(context.portfolioHeat * 100)}%.`);
  }

  sizeFactor = round(clamp(sizeFactor, 0.35, 1), 2);
  let leverageCap: number | null = mode === "futures" ? snapshot.settings.exchange.futuresLeverage : 1;

  if (mode === "futures") {
    if (modeUtilization >= 0.85 || context.portfolioHeat >= 0.9) {
      leverageCap = 1;
    } else if (bucketUtilization >= 0.75 || sideUtilization >= 0.8 || context.portfolioHeat >= 0.75) {
      leverageCap = Math.min(leverageCap ?? 1, 2);
    } else if (modeUtilization >= 0.55 || context.portfolioHeat >= 0.6) {
      leverageCap = Math.min(leverageCap ?? 1, 3);
    }
  }

  const blockNewEntries = (mode === "futures" && modeUtilization >= 0.98) || (bucketUtilization >= 1.05 && sameSideDominant && bucketPositions.length > 0);
  const status: PortfolioAllocationPlan["status"] = blockNewEntries
    ? "Blocked"
    : sizeFactor < 0.8 || (mode === "futures" && (leverageCap ?? 1) < snapshot.settings.exchange.futuresLeverage)
      ? "Constrained"
      : modePositions.length > 0
        ? "Sizing"
        : "Idle";
  const summary = blockNewEntries
    ? `Portfolio allocation blocked ${target.symbol} because ${accountModeLabel(mode).toLowerCase()} exposure is already beyond the safe working envelope.`
    : status === "Constrained"
      ? `Portfolio allocation is tapering ${target.symbol} to ${Math.round(sizeFactor * 100)}% of the base ticket${mode === "futures" ? ` and ${leverageCap}x max leverage` : ""}.`
      : `Portfolio allocation is clear enough for a normal ${accountModeLabel(mode).toLowerCase()} ticket in ${target.symbol}.`;

  return {
    active: true,
    status,
    mode,
    targetSymbol: target.symbol,
    targetAccountMode: mode,
    targetBucket: bucket,
    targetSide: target.side,
    summary,
    reasons: reasons.slice(0, 4),
    recommendedSizeMultiplier: sizeFactor,
    effectiveTradeSizeUsd: round((snapshot.strategy.runner?.tradeSizeUsd ?? 750) * sizeFactor, 2),
    leverageCap: mode === "futures" ? Math.max(leverageCap ?? 1, 1) : 1,
    modeExposureUtilization: modeUtilization,
    bucketExposureUtilization: bucketUtilization,
    sideExposureUtilization: sideUtilization,
    portfolioHeat: context.portfolioHeat,
    openPositionsInMode: modePositions.length,
    openPositionsInBucket: bucketPositions.length,
    appliedAt: null,
    blockNewEntries
  };
}

function emptyModeAttribution(mode: ExchangeAccountMode): ModeAttributionSnapshot {
  return {
    mode,
    openPositions: 0,
    closedTrades: 0,
    winRate: 0,
    realizedToday: 0,
    realizedWeek: 0,
    realizedTotal: 0,
    openUnrealized: 0,
    capitalDeployedUsd: 0,
    openNotionalUsd: 0,
    maxDrawdown: 0,
    averageLeverage: mode === "futures" ? 1 : 1,
    equityCurve: []
  };
}

function buildModeAttribution(mode: ExchangeAccountMode, trades: TradeRecord[], positions: PositionRecord[]): ModeAttributionSnapshot {
  const modeTrades = trades.filter((trade) => trade.accountMode === mode);
  const modePositions = positions.filter((position) => position.accountMode === mode);
  const closedTrades = modeTrades.filter((trade) => trade.status === "Closed");

  if (closedTrades.length === 0 && modePositions.length === 0) {
    return emptyModeAttribution(mode);
  }

  const winningTrades = closedTrades.filter((trade) => trade.realizedPnL > 0);
  const realizedToday = closedTrades
    .filter((trade) => trade.closedAt && sameDay(new Date(trade.closedAt)))
    .reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const realizedWeek = closedTrades
    .filter((trade) => trade.closedAt && withinDays(new Date(trade.closedAt), 7))
    .reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const realizedTotal = closedTrades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const openUnrealized = modePositions.reduce((sum, position) => sum + position.unrealizedPnL, 0);
  const capitalDeployedUsd = round(modePositions.reduce((sum, position) => sum + position.collateral, 0), 2);
  const openNotionalUsd = round(modePositions.reduce((sum, position) => sum + Math.abs(position.currentPrice * position.size), 0), 2);
  const averageTradeCapital = average(closedTrades.map((trade) => tradeCapitalUsedUsd(trade)));
  const syntheticCapitalBase = round(Math.max(capitalDeployedUsd, averageTradeCapital, 1000), 2);
  const syntheticEquity = round(syntheticCapitalBase + realizedTotal + openUnrealized, 2);
  const equityCurve = buildEquityCurve(closedTrades, syntheticEquity, openUnrealized);
  const leverageSamples = [
    ...modePositions.map((position) => accountLeverage(mode, position.leverage)),
    ...closedTrades.map((trade) => tradeEffectiveLeverage(trade))
  ];

  return {
    mode,
    openPositions: modePositions.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length === 0 ? 0 : round((winningTrades.length / closedTrades.length) * 100, 1),
    realizedToday: round(realizedToday, 2),
    realizedWeek: round(realizedWeek, 2),
    realizedTotal: round(realizedTotal, 2),
    openUnrealized: round(openUnrealized, 2),
    capitalDeployedUsd,
    openNotionalUsd,
    maxDrawdown: computeMaxDrawdown(equityCurve),
    averageLeverage: round(Math.max(average(leverageSamples), 1), 2),
    equityCurve
  };
}

function consecutiveLossStreak(trades: TradeRecord[], mode?: ExchangeAccountMode) {
  const closedTrades = trades
    .filter((trade) => trade.status === "Closed" && (!mode || trade.accountMode === mode))
    .sort((left, right) => new Date(right.closedAt ?? right.openedAt).getTime() - new Date(left.closedAt ?? left.openedAt).getTime());

  let streak = 0;
  for (const trade of closedTrades) {
    if (trade.realizedPnL < 0) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function minimumFuturesLiquidationBuffer(positions: PositionRecord[]) {
  const buffers = positions
    .filter((position) => position.accountMode === "futures")
    .map((position) => calculateLiquidationDistancePercent(position.entryPrice, position.liquidationPrice))
    .filter((value): value is number => value != null);
  return buffers.length > 0 ? round(Math.min(...buffers), 2) : null;
}

function buildFuturesThrottle(snapshot: ProofTraderSnapshot, attribution = buildModeAttribution("futures", snapshot.trades, snapshot.positions)): StrategyFuturesThrottleState {
  const policy = snapshot.risk.policy;
  const configuredTradeCap = Math.max(snapshot.strategy.runner?.maxTradesPerDay ?? 4, 1);
  const configuredConfidenceThreshold = clamp(snapshot.strategy.runner?.confidenceThreshold ?? 0.68, 0.5, 0.95);
  const configuredLeverage = accountLeverage("futures", Math.min(snapshot.settings.exchange.futuresLeverage ?? 2, policy.futuresMaxLeverage));
  const minBuffer = minimumFuturesLiquidationBuffer(snapshot.positions);
  const lossStreak = consecutiveLossStreak(snapshot.trades, "futures");
  const dailyLossUtilization = round(Math.abs(Math.min(attribution.realizedToday, 0)) / Math.max(policy.futuresMaxDailyLossUsd, 1), 2);
  const drawdownUtilization = round(Math.abs(Math.min(attribution.maxDrawdown, 0)) / Math.max(policy.futuresMaxDrawdownPercent, 0.01), 2);
  const exposureUtilization = round(attribution.openNotionalUsd / Math.max(policy.futuresMaxOpenNotionalUsd, 1), 2);
  const reasons: string[] = [];
  let score = 0;

  const addSignal = (weight: number, reason: string) => {
    score += weight;
    reasons.push(reason);
  };

  if (dailyLossUtilization >= 0.9) {
    addSignal(4, `Daily futures loss utilization is ${Math.round(dailyLossUtilization * 100)}% of the configured cap.`);
  } else if (dailyLossUtilization >= 0.65) {
    addSignal(2, `Daily futures loss utilization is elevated at ${Math.round(dailyLossUtilization * 100)}% of the cap.`);
  } else if (dailyLossUtilization >= 0.35) {
    addSignal(1, `Daily futures loss utilization is building at ${Math.round(dailyLossUtilization * 100)}% of the cap.`);
  }

  if (drawdownUtilization >= 0.9) {
    addSignal(4, `Futures drawdown is at ${Math.round(drawdownUtilization * 100)}% of the allowed limit.`);
  } else if (drawdownUtilization >= 0.65) {
    addSignal(2, `Futures drawdown is elevated at ${Math.round(drawdownUtilization * 100)}% of the limit.`);
  } else if (drawdownUtilization >= 0.4) {
    addSignal(1, `Futures drawdown is warming up at ${Math.round(drawdownUtilization * 100)}% of the limit.`);
  }

  if (exposureUtilization >= 0.9) {
    addSignal(3, `Open futures notional is using ${Math.round(exposureUtilization * 100)}% of the futures exposure cap.`);
  } else if (exposureUtilization >= 0.7) {
    addSignal(2, `Open futures notional is already heavy at ${Math.round(exposureUtilization * 100)}% of the cap.`);
  } else if (exposureUtilization >= 0.45) {
    addSignal(1, `Open futures exposure is mid-range at ${Math.round(exposureUtilization * 100)}% of the cap.`);
  }

  if (minBuffer != null) {
    const bufferRatio = round(minBuffer / Math.max(policy.futuresMinLiquidationDistancePercent, 0.01), 2);
    if (bufferRatio <= 0.95) {
      addSignal(4, `Nearest futures liquidation buffer is only ${minBuffer.toFixed(2)}%.`);
    } else if (bufferRatio <= 1.15) {
      addSignal(2, `Nearest futures liquidation buffer is compressing at ${minBuffer.toFixed(2)}%.`);
    } else if (bufferRatio <= 1.35) {
      addSignal(1, `Nearest futures liquidation buffer is no longer comfortably wide at ${minBuffer.toFixed(2)}%.`);
    }
  }

  if (lossStreak >= 3) {
    addSignal(3, `Futures closed trades show a ${lossStreak}-trade loss streak.`);
  } else if (lossStreak === 2) {
    addSignal(2, `Futures closed trades show back-to-back losses.`);
  } else if (lossStreak === 1) {
    addSignal(1, `Latest futures trade closed at a loss.`);
  }

  if (attribution.closedTrades >= 4 && attribution.winRate < 35) {
    addSignal(2, `Futures win rate is weak at ${attribution.winRate.toFixed(1)}%.`);
  } else if (attribution.closedTrades >= 4 && attribution.winRate < 50) {
    addSignal(1, `Futures win rate is soft at ${attribution.winRate.toFixed(1)}%.`);
  }

  if (attribution.closedTrades >= 3 && attribution.realizedWeek < 0) {
    addSignal(1, `Futures realized PnL over the last 7 days is negative at $${Math.abs(attribution.realizedWeek).toFixed(2)}.`);
  }

  const posture = score >= 8 ? "Defensive" : score >= 5 ? "Tight" : score >= 3 ? "Guarded" : "Normal";
  const sizeFactor = posture === "Defensive" ? 0.55 : posture === "Tight" ? 0.7 : posture === "Guarded" ? 0.85 : 1;
  const confidenceBump = posture === "Defensive" ? 0.09 : posture === "Tight" ? 0.06 : posture === "Guarded" ? 0.03 : 0;
  const adjustedConfidenceThreshold = clamp(configuredConfidenceThreshold + confidenceBump, configuredConfidenceThreshold, 0.95);
  const adjustedMaxTradesPerDay = posture === "Defensive"
    ? 0
    : posture === "Tight"
      ? Math.max(1, Math.min(configuredTradeCap, 2))
      : posture === "Guarded"
        ? Math.max(1, configuredTradeCap - 1)
        : configuredTradeCap;
  const leverageCap = posture === "Defensive"
    ? 1
    : posture === "Tight"
      ? Math.max(1, Math.min(configuredLeverage, 2))
      : posture === "Guarded"
        ? Math.max(1, Math.min(configuredLeverage, 3))
        : configuredLeverage;
  const blockNewEntries = posture === "Defensive" || dailyLossUtilization >= 0.95 || drawdownUtilization >= 0.95 || (minBuffer != null && minBuffer < policy.futuresMinLiquidationDistancePercent);

  const summary = posture === "Normal"
    ? "Futures attribution remains healthy enough for the normal AI execution envelope."
    : posture === "Guarded"
      ? `Futures attribution is soft, so the runner is tightening entries to ${Math.round(sizeFactor * 100)}% size, ${Math.round(adjustedConfidenceThreshold * 100)}% confidence, and ${leverageCap}x max leverage.`
      : posture === "Tight"
        ? `Futures attribution is weak, so the runner is materially reducing aggression to ${Math.round(sizeFactor * 100)}% size, ${Math.round(adjustedConfidenceThreshold * 100)}% confidence, ${adjustedMaxTradesPerDay} max new trade${adjustedMaxTradesPerDay === 1 ? "" : "s"}, and ${leverageCap}x max leverage.`
        : "Futures attribution is under pressure, so the runner is holding back fresh futures entries until the mode stabilizes.";

  return {
    mode: snapshot.settings.exchange.accountMode ?? "spot",
    active: (snapshot.settings.exchange.accountMode ?? "spot") === "futures" && posture !== "Normal",
    posture,
    score,
    blockNewEntries,
    adjustedConfidenceThreshold: round(adjustedConfidenceThreshold, 2),
    adjustedMaxTradesPerDay,
    adjustedTradeSizeUsd: round((snapshot.strategy.runner?.tradeSizeUsd ?? 750) * sizeFactor, 2),
    leverageCap,
    sizeFactor: round(sizeFactor, 2),
    summary,
    reasons,
    dailyLossUtilization,
    drawdownUtilization,
    exposureUtilization,
    minLiquidationBufferPercent: minBuffer,
    lossStreak,
    winRate: attribution.winRate
  };
}

function buildFuturesDefensePlan(snapshot: ProofTraderSnapshot, throttle = buildFuturesThrottle(snapshot)): FuturesDefensePlan {
  const futuresPositions = snapshot.positions.filter((position) => position.accountMode === "futures");

  if (futuresPositions.length === 0) {
    return {
      mode: snapshot.settings.exchange.accountMode ?? "spot",
      active: false,
      posture: throttle.posture,
      status: "Idle",
      action: "HOLD",
      summary: "No open futures positions require automated defense right now.",
      targetPositionId: null,
      targetSymbol: null,
      reasons: [],
      liveLiquidationBufferPercent: null,
      lossOnCollateralPercent: null,
      unrealizedPnL: null,
      appliedAt: null,
      score: 0,
      targetReduceFraction: null
    };
  }

  const policy = snapshot.risk.policy;
  let bestPlan: FuturesDefensePlan | null = null;

  for (const position of futuresPositions) {
    const liveBuffer = calculateLiveLiquidationBufferPercent(position.currentPrice, position.liquidationPrice);
    const lossOnCollateralPercent = position.collateral > 0 ? round((Math.min(position.unrealizedPnL, 0) / position.collateral) * 100, 2) : 0;
    const stopHit = isStopLossTriggered(position);
    const takeProfitHit = isTakeProfitTriggered(position);
    const reasons: string[] = [];
    let score = 0;

    if (takeProfitHit) {
      score += 8;
      reasons.push(`Take-profit is already in range on ${position.symbol}.`);
    }

    if (stopHit) {
      score += 9;
      reasons.push(`Stop-loss is already breached on ${position.symbol}.`);
    }

    if (liveBuffer != null) {
      if (liveBuffer < policy.futuresMinLiquidationDistancePercent * 0.8) {
        score += 8;
        reasons.push(`Live liquidation buffer is critically tight at ${liveBuffer.toFixed(2)}%.`);
      } else if (liveBuffer < policy.futuresMinLiquidationDistancePercent) {
        score += 6;
        reasons.push(`Live liquidation buffer is below policy at ${liveBuffer.toFixed(2)}%.`);
      } else if (liveBuffer < policy.futuresMinLiquidationDistancePercent + 4) {
        score += 4;
        reasons.push(`Live liquidation buffer is compressing at ${liveBuffer.toFixed(2)}%.`);
      } else if (liveBuffer < policy.futuresMinLiquidationDistancePercent + 7) {
        score += 2;
        reasons.push(`Live liquidation buffer is no longer comfortably wide at ${liveBuffer.toFixed(2)}%.`);
      }
    }

    if (lossOnCollateralPercent <= -12) {
      score += 4;
      reasons.push(`Loss on posted collateral is severe at ${Math.abs(lossOnCollateralPercent).toFixed(2)}%.`);
    } else if (lossOnCollateralPercent <= -8) {
      score += 3;
      reasons.push(`Loss on posted collateral is elevated at ${Math.abs(lossOnCollateralPercent).toFixed(2)}%.`);
    } else if (lossOnCollateralPercent <= -4) {
      score += 2;
      reasons.push(`Loss on posted collateral is building at ${Math.abs(lossOnCollateralPercent).toFixed(2)}%.`);
    }

    if (position.unrealizedPnL < 0) {
      score += 1;
      reasons.push(`Position is currently down $${Math.abs(position.unrealizedPnL).toFixed(2)}.`);
    }

    if (position.leverage > throttle.leverageCap) {
      score += 3;
      reasons.push(`Position leverage is ${position.leverage}x while the live cap is ${throttle.leverageCap}x.`);
    } else if (throttle.posture !== "Normal" && position.leverage === throttle.leverageCap) {
      score += 1;
      reasons.push(`Position is already sitting on the tightened ${throttle.leverageCap}x cap.`);
    }

    if (throttle.posture === "Defensive") score += 3;
    else if (throttle.posture === "Tight") score += 2;
    else if (throttle.posture === "Guarded") score += 1;

    let action: FuturesDefenseAction = "HOLD";
    let status: FuturesDefensePlan["status"] = throttle.posture === "Normal" ? "Idle" : "Monitoring";
    let targetReduceFraction: number | null = null;

    if (takeProfitHit || stopHit || (liveBuffer != null && liveBuffer < policy.futuresMinLiquidationDistancePercent * 0.8)) {
      action = "CLOSE";
      status = "Close Planned";
    } else if (throttle.posture === "Defensive" && (score >= 8 || position.unrealizedPnL < 0 || (liveBuffer != null && liveBuffer < policy.futuresMinLiquidationDistancePercent + 4))) {
      action = score >= 10 ? "CLOSE" : "REDUCE_50";
      status = action === "CLOSE" ? "Close Planned" : "Reduce Planned";
      targetReduceFraction = action === "REDUCE_50" ? 0.5 : null;
    } else if (throttle.posture === "Tight" && score >= 6) {
      action = "REDUCE_25";
      status = "Reduce Planned";
      targetReduceFraction = 0.25;
    } else if (throttle.posture === "Guarded" && score >= 7 && position.unrealizedPnL < 0) {
      action = "REDUCE_25";
      status = "Reduce Planned";
      targetReduceFraction = 0.25;
    }

    const summary = action === "CLOSE"
      ? `Futures defense wants to close ${position.symbol} because the open risk profile is no longer acceptable.`
      : action === "REDUCE_50"
        ? `Futures defense wants to cut ${position.symbol} by 50% to widen balance between risk and opportunity.`
        : action === "REDUCE_25"
          ? `Futures defense wants to trim ${position.symbol} by 25% while the futures posture is tightened.`
          : throttle.posture === "Normal"
            ? `Futures posture is normal. ${position.symbol} does not need a protective action yet.`
            : `Futures posture is ${throttle.posture.toLowerCase()}, but ${position.symbol} is still only being monitored.`;

    const candidatePlan: FuturesDefensePlan = {
      mode: snapshot.settings.exchange.accountMode ?? "spot",
      active: action !== "HOLD" || throttle.posture !== "Normal",
      posture: throttle.posture,
      status,
      action,
      summary,
      targetPositionId: position.id,
      targetSymbol: position.symbol,
      reasons: reasons.slice(0, 4),
      liveLiquidationBufferPercent: liveBuffer,
      lossOnCollateralPercent,
      unrealizedPnL: round(position.unrealizedPnL, 2),
      appliedAt: null,
      score,
      targetReduceFraction
    };

    if (!bestPlan || candidatePlan.score > bestPlan.score || (candidatePlan.score === bestPlan.score && action !== "HOLD" && bestPlan.action === "HOLD")) {
      bestPlan = candidatePlan;
    }
  }

  return bestPlan ?? {
    mode: snapshot.settings.exchange.accountMode ?? "spot",
    active: throttle.posture !== "Normal",
    posture: throttle.posture,
    status: throttle.posture === "Normal" ? "Idle" : "Monitoring",
    action: "HOLD",
    summary: throttle.posture === "Normal" ? "No automated futures defense action is needed right now." : `Futures posture is ${throttle.posture.toLowerCase()}, but no position is beyond the defense threshold yet.`,
    targetPositionId: null,
    targetSymbol: null,
    reasons: [],
    liveLiquidationBufferPercent: null,
    lossOnCollateralPercent: null,
    unrealizedPnL: null,
    appliedAt: null,
    score: 0,
    targetReduceFraction: null
  };
}

function buildPositionExitPlan(snapshot: ProofTraderSnapshot): PositionExitPlan {
  const scoredTargets = snapshot.positions
    .map((position) => {
      const stopHit = isStopLossTriggered(position);
      const takeProfitHit = isTakeProfitTriggered(position);
      if (!stopHit && !takeProfitHit) {
        return null;
      }

      const trigger: PositionExitTarget["trigger"] = stopHit ? "stop_loss" : "take_profit";
      const urgency = (trigger === "stop_loss" ? 100 : 50)
        + (position.accountMode === "futures" ? 10 : 0)
        + Math.min(Math.abs(position.unrealizedPnL), 25);

      return {
        target: {
          positionId: position.id,
          symbol: position.symbol,
          accountMode: position.accountMode,
          side: position.side,
          trigger,
          currentPrice: position.currentPrice,
          unrealizedPnL: position.unrealizedPnL
        } satisfies PositionExitTarget,
        urgency,
        reason: trigger === "stop_loss"
          ? `${position.symbol} ${position.accountMode} ${position.side.toLowerCase()} hit stop loss at $${position.currentPrice.toFixed(2)}.`
          : `${position.symbol} ${position.accountMode} ${position.side.toLowerCase()} reached take profit at $${position.currentPrice.toFixed(2)}.`
      };
    })
    .filter((item): item is { target: PositionExitTarget; urgency: number; reason: string } => Boolean(item))
    .sort((left, right) => right.urgency - left.urgency);

  const targets = scoredTargets.map((item) => item.target);
  const stopTriggeredCount = targets.filter((target) => target.trigger === "stop_loss").length;
  const takeProfitTriggeredCount = targets.filter((target) => target.trigger === "take_profit").length;
  const primaryTarget = targets[0] ?? null;
  const action: PositionExitAction = stopTriggeredCount > 0 && takeProfitTriggeredCount > 0
    ? "MIXED_CLOSE"
    : stopTriggeredCount > 0
      ? "STOP_LOSS_CLOSE"
      : takeProfitTriggeredCount > 0
        ? "TAKE_PROFIT_CLOSE"
        : "HOLD";

  if (!primaryTarget) {
    return {
      active: snapshot.positions.length > 0,
      status: snapshot.positions.length > 0 ? "Monitoring" : "Idle",
      action: "HOLD",
      summary: snapshot.positions.length > 0
        ? "Auto exits are armed and watching all open positions for stop-loss or take-profit triggers."
        : "No open positions require auto exit monitoring right now.",
      targetPositionId: null,
      targetSymbol: null,
      targetAccountMode: null,
      reasons: [],
      stopTriggeredCount: 0,
      takeProfitTriggeredCount: 0,
      appliedAt: null,
      lastExitPrice: null,
      lastRealizedPnL: null,
      targets: []
    };
  }

  const reasonSummary = [
    stopTriggeredCount > 0 ? `${stopTriggeredCount} stop-loss close${stopTriggeredCount === 1 ? "" : "s"} ready.` : null,
    takeProfitTriggeredCount > 0 ? `${takeProfitTriggeredCount} take-profit close${takeProfitTriggeredCount === 1 ? "" : "s"} ready.` : null
  ].filter((value): value is string => Boolean(value));

  return {
    active: true,
    status: "Exit Planned",
    action,
    summary: targets.length === 1
      ? `${primaryTarget.symbol} is ready for an automatic ${primaryTarget.trigger === "stop_loss" ? "stop-loss" : "take-profit"} close.`
      : `${targets.length} positions are ready for automatic exits before any new entry decisions are made.`,
    targetPositionId: primaryTarget.positionId,
    targetSymbol: primaryTarget.symbol,
    targetAccountMode: primaryTarget.accountMode,
    reasons: [...reasonSummary, ...scoredTargets.slice(0, 3).map((item) => item.reason)].slice(0, 4),
    stopTriggeredCount,
    takeProfitTriggeredCount,
    appliedAt: null,
    lastExitPrice: null,
    lastRealizedPnL: null,
    targets
  };
}

function normalizeRiskPolicy(policy: RiskPolicy): RiskPolicy {
  const raw = policy as RiskPolicy & Record<string, unknown>;
  return {
    ...policy,
    maxDailyLossUsd: Math.max(Number(policy.maxDailyLossUsd ?? 0), 100),
    maxWeeklyDrawdownPercent: clamp(Number(policy.maxWeeklyDrawdownPercent ?? 0), 0.5, 100),
    maxPositionSizeUsd: Math.max(Number(policy.maxPositionSizeUsd ?? 0), 100),
    maxConcurrentPositions: Math.max(Math.round(Number(policy.maxConcurrentPositions ?? 1)), 1),
    perTradeRiskPercent: clamp(Number(policy.perTradeRiskPercent ?? 0.5), 0.05, 10),
    cooldownAfterLosses: Math.max(Math.round(Number(policy.cooldownAfterLosses ?? 3)), 1),
    volatilityGuardrailPercent: clamp(Number(policy.volatilityGuardrailPercent ?? 25), 0.1, 100),
    spreadGuardrailPercent: clamp(Number(policy.spreadGuardrailPercent ?? 0.15), 0.01, 5),
    slippageGuardrailPercent: clamp(Number(policy.slippageGuardrailPercent ?? 0.2), 0.01, 5),
    futuresMaxLeverage: Math.max(Math.round(Number(raw.futuresMaxLeverage ?? 4)), 1),
    futuresMaxDailyLossUsd: Math.max(Number(raw.futuresMaxDailyLossUsd ?? Math.max(Number(policy.maxDailyLossUsd ?? 0) * 0.5, 250)), 100),
    futuresMaxDrawdownPercent: clamp(Number(raw.futuresMaxDrawdownPercent ?? Math.max(Math.min(Number(policy.maxWeeklyDrawdownPercent ?? 4), 4), 1.5)), 0.5, 100),
    futuresMaxPositionNotionalUsd: Math.max(Number(raw.futuresMaxPositionNotionalUsd ?? Math.max(Number(policy.maxPositionSizeUsd ?? 0) * 0.6, 1000)), 100),
    futuresMaxOpenNotionalUsd: Math.max(Number(raw.futuresMaxOpenNotionalUsd ?? Math.max(Number(policy.maxPositionSizeUsd ?? 0) * 1.5, 2500)), 100),
    futuresMinLiquidationDistancePercent: clamp(Number(raw.futuresMinLiquidationDistancePercent ?? 18), 2, 95),
    whitelistedMarkets: Array.from(new Set((policy.whitelistedMarkets ?? []).filter(Boolean)))
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => Math.pow(value - mean, 2))));
}

function lastN<T>(values: T[], count: number) {
  return values.slice(-Math.max(count, 1));
}

function simpleMovingAverage(values: number[], period: number) {
  const window = lastN(values, Math.min(period, values.length));
  return average(window);
}

function closeSeries(candles: OhlcCandle[]) {
  return candles.map((candle) => candle.close);
}

function returnSeries(values: number[]) {
  return values.slice(1).map((value, index) => {
    const base = values[index];
    return base === 0 ? 0 : ((value - base) / base) * 100;
  });
}

function computeAtrPercent(candles: OhlcCandle[], period = 14) {
  if (candles.length < 2) return 0;
  const window = lastN(candles, Math.min(period + 1, candles.length));
  const trueRanges = window.slice(1).map((candle, index) => {
    const previousClose = window[index].close;
    const rangeA = candle.high - candle.low;
    const rangeB = Math.abs(candle.high - previousClose);
    const rangeC = Math.abs(candle.low - previousClose);
    return Math.max(rangeA, rangeB, rangeC);
  });
  const latestClose = window[window.length - 1]?.close ?? 0;
  return latestClose === 0 ? 0 : (average(trueRanges) / latestClose) * 100;
}

function computeTrendPercent(candles: OhlcCandle[], fastPeriod: number, slowPeriod: number) {
  const closes = closeSeries(candles);
  const fast = simpleMovingAverage(closes, fastPeriod);
  const slow = simpleMovingAverage(closes, slowPeriod);
  return slow === 0 ? 0 : ((fast - slow) / slow) * 100;
}

function computeMomentumPercent(candles: OhlcCandle[], lookback: number) {
  if (candles.length === 0) return 0;
  const latest = candles[candles.length - 1].close;
  const baseline = candles[Math.max(candles.length - 1 - lookback, 0)]?.close ?? latest;
  return baseline === 0 ? 0 : ((latest - baseline) / baseline) * 100;
}

function computeRangePositionFromCandles(candles: OhlcCandle[], period = 20) {
  if (candles.length === 0) return 0.5;
  const window = lastN(candles, Math.min(period, candles.length));
  const latest = window[window.length - 1].close;
  const low = Math.min(...window.map((candle) => candle.low));
  const high = Math.max(...window.map((candle) => candle.high));
  const span = high - low;
  return span <= 0 ? 0.5 : (latest - low) / span;
}

function computeBreakoutPressure(candles: OhlcCandle[], rangePosition: number) {
  if (candles.length < 3) return 0;
  const closes = closeSeries(candles);
  const latest = closes[closes.length - 1];
  const averageClose = average(lastN(closes, Math.min(8, closes.length)));
  const volumeSeries = candles.map((candle) => candle.volume);
  const latestVolume = volumeSeries[volumeSeries.length - 1] ?? 0;
  const averageVolume = average(lastN(volumeSeries, Math.min(8, volumeSeries.length))) || latestVolume;
  const priceExtension = averageClose === 0 ? 0 : Math.abs((latest - averageClose) / averageClose) * 100;
  return clamp((rangePosition > 0.5 ? rangePosition : 1 - rangePosition) * 0.55 + Math.min(priceExtension / 1.25, 1) * 0.25 + Math.min(latestVolume / Math.max(averageVolume, 0.0001), 2) * 0.1, 0, 1);
}

function computeStretchScore(candles: OhlcCandle[]) {
  const closes = closeSeries(candles);
  if (closes.length < 5) return 0;
  const mean = average(lastN(closes, Math.min(10, closes.length)));
  const std = standardDeviation(lastN(closes, Math.min(10, closes.length)));
  if (std === 0) return 0;
  return (closes[closes.length - 1] - mean) / std;
}

function inferMarketRegime(context: MarketContext) {
  if (context.executionQuality < 0.42 || context.spreadBps > 16 || context.atr15mPercent > 2.8) {
    return "Risk Off";
  }

  const alignedUp = context.trend1hPercent > 0.18 && context.trend15mPercent > 0.08;
  const alignedDown = context.trend1hPercent < -0.18 && context.trend15mPercent < -0.08;
  if (alignedUp) return "Bull Trend";
  if (alignedDown) return "Bear Trend";
  if (Math.abs(context.trend1hPercent) < 0.16 && Math.abs(context.trend15mPercent) < 0.12) return "Range";
  return "Transition";
}

function formatSyncLabel(date: Date | null, reference = new Date()) {
  if (!date) return "Not synced yet";
  const diffMs = Math.max(reference.getTime() - date.getTime(), 0);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function setMetricValue(snapshot: ProofTraderSnapshot, label: string, value: number, suffix?: string) {
  snapshot.dashboard.metricCards = snapshot.dashboard.metricCards.map((card) => {
    if (card.label !== label) return card;
    return {
      ...card,
      value,
      suffix: suffix ?? card.suffix
    };
  });
}


function mapLogLevel(level: string): LogRecord["level"] {
  if (level === "warning" || level === "error" || level === "success") return level;
  return "info";
}

function groupLogs(records: Array<{ stream: string; id: string; createdAt: Date; level: string; message: string; details: unknown }>) {
  const grouped = {
    execution: [] as LogRecord[],
    signal: [] as LogRecord[],
    risk: [] as LogRecord[],
    publish: [] as LogRecord[],
    error: [] as LogRecord[]
  };

  for (const record of records) {
    const stream = (record.stream in grouped ? record.stream : "execution") as keyof typeof grouped;
    grouped[stream].push({
      id: record.id,
      timestamp: record.createdAt.toISOString(),
      level: mapLogLevel(record.level),
      message: record.message,
      details: typeof record.details === "object" && record.details ? (record.details as Record<string, unknown>) : {}
    });
  }

  return grouped;
}

const DEMO_TRADE_IDS = new Set(seedSnapshot.trades.map((trade) => trade.id));
const DEMO_POSITION_IDS = new Set(seedSnapshot.positions.map((position) => position.id));
const DEMO_ARTIFACT_IDS = new Set(seedSnapshot.validation.artifacts.map((artifact) => artifact.id));
const DEMO_SIGNAL_IDS = new Set(seedSnapshot.dashboard.recentSignals.map((signal) => signal.id));
const DEMO_EVENT_IDS = new Set(seedSnapshot.strategy.eventHistory.map((event) => event.id));
const DEMO_RISK_CHECK_IDS = new Set(seedSnapshot.risk.checks.map((check) => check.id));
const DEMO_RISK_EVENT_IDS = new Set(seedSnapshot.risk.events.map((event) => event.id));
const DEMO_LOG_IDS = new Set([
  ...seedSnapshot.logs.execution,
  ...seedSnapshot.logs.signal,
  ...seedSnapshot.logs.risk,
  ...seedSnapshot.logs.publish,
  ...seedSnapshot.logs.error
].map((item) => item.id));
const DEMO_JOB_IDS = new Set(seedSnapshot.logs.jobs.map((job) => job.id));
const DEMO_AI_COMMENTARY_KEYS = new Set(seedSnapshot.strategy.aiCommentary.map((item) => `${item.label}|${item.timestamp}|${item.body}`));
const SEEDED_API_KEY = seedSnapshot.settings.exchange.apiKey;
const SEEDED_API_SECRET = seedSnapshot.settings.exchange.apiSecret;

function formatChartDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function createInitialSnapshot(): ProofTraderSnapshot {
  const snapshot = deepClone(seedSnapshot);
  snapshot.generatedAt = new Date().toISOString();
  snapshot.risk.policy = normalizeRiskPolicy(snapshot.risk.policy);
  snapshot.system = {
    environment: "Production",
    healthLabel: "Awaiting live data",
    notifications: 0,
    connections: {
      exchangeConnected: false,
      websocketConnected: false,
      chainSynced: Boolean(snapshot.settings.blockchain.rpcEndpoint),
      publishWorkerHealthy: true,
      queueHealthy: true,
      lastSyncLabel: "Not synced yet",
      rateLimitAvailable: "Unknown"
    }
  };
  snapshot.dashboard = {
    ...snapshot.dashboard,
    equityCurve: [],
    metricCards: [
      { label: "Total Equity", value: 0, format: "currency", suffix: "No synced capital" },
      { label: "Available Balance", value: 0, format: "currency", suffix: "No synced cash" },
      { label: "Daily PnL", value: 0, format: "currency", suffix: "Today" },
      { label: "Weekly PnL", value: 0, format: "currency", suffix: "7d" }
    ],
    attributionByMode: {
      spot: emptyModeAttribution("spot"),
      futures: emptyModeAttribution("futures")
    },
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    totalTrades: 0,
    openPositionsPreview: [],
    recentTradesPreview: [],
    recentSignals: [],
    recentArtifacts: []
  };
  snapshot.paper = {
    status: "idle",
    accountMode: "spot",
    leverage: 1,
    source: "snapshot",
    initialized: false,
    syncedAt: null,
    equity: 0,
    balance: 0,
    unrealizedPnL: 0,
    realizedPnL: 0,
    tradeCount: 0,
    openPositionCount: 0,
    lastError: null,
    recentOrders: []
  };
  snapshot.trades = [];
  snapshot.positions = [];
  snapshot.strategy = {
    ...snapshot.strategy,
    selectedStrategy: "AI Regime & Execution Strategist",
    currentMode: "AI Awaiting Candidates",
    marketRegime: "AI Warmup",
    readiness: "Awaiting AI market features",
    signalsToday: 0,
    executedToday: 0,
    blockedToday: 0,
    performance: [],
    eventHistory: [],
    aiCommentary: [],
    allowedSymbols: [...snapshot.risk.policy.whitelistedMarkets],
    entryRules: [
      "AI ranks only bounded candidates from trend continuation, breakout expansion, and mean reversion modules.",
      "The feature engine aligns 1h regime, 15m setup quality, 5m entry timing, ATR, and order-book execution quality before a candidate is born.",
      "Every candidate must clear the hard confidence threshold and professional execution filters for spread, depth, and correlated exposure.",
      "Only one open position per watched symbol is allowed and same-side correlated stacking is capped."
    ],
    exitRules: [
      "Every executed trade receives ATR-aware bounded stop-loss and take-profit percentages before order submission.",
      "AI tunes the execution envelope inside hard limits and the risk engine enforces it deterministically.",
      "Daily trade caps, drawdown control, correlated exposure limits, and cooldown after loss streaks can block fresh entries.",
      "Open positions are re-marked from live prices during paper sync cycles and futures defense can automatically trim or close stressed exposure."
    ],
    executionPolicy: "AI selects the module and candidate. The risk engine enforces volatility, spread, depth, exposure, and portfolio-allocation filters. Kraken CLI executes.",
    positionSizing: "Base ticket size is scaled by bounded AI multipliers, ATR-aware risk budgeting, execution-quality penalties, portfolio heat, and mode or bucket concentration caps.",
    runner: {
      enabled: false,
      status: "Stopped",
      cadenceSeconds: 60,
      confidenceThreshold: 0.68,
      tradeSizeUsd: 750,
      maxTradesPerDay: 4,
      cooldownAfterLosses: snapshot.risk.policy.cooldownAfterLosses,
      lastRunAt: null,
      lastSignalAt: null,
      lastTradeAt: null,
      watchedSymbols: [...snapshot.risk.policy.whitelistedMarkets],
      latestSummary: "Strategy runner is idle."
    },
    ai: {
      enabled: false,
      provider: "heuristic",
      model: "not-configured",
      status: "Fallback",
      lastDecisionAt: null,
      recommendedAction: "HOLD",
      recommendedSymbol: null,
      confidence: null,
      rationale: "AI reasoning is not configured yet.",
      riskNote: "Risk checks still run before every execution.",
      error: null,
      selectedCandidateId: null,
      strategyModule: null,
      executionBias: null,
      sizeMultiplier: null,
      stopLossPercent: null,
      takeProfitPercent: null,
      rankingSummary: null,
      futuresThrottle: null,
      futuresDefense: null,
      positionExitEngine: null,
      portfolioAllocation: null
    }
  };
  snapshot.risk = {
    ...snapshot.risk,
    checks: [],
    blockedTradeIntents: [],
    events: [],
    circuitBreaker: "Normal",
    blockedTrades24h: 0
  };
  snapshot.validation = {
    ...snapshot.validation,
    artifacts: [],
    trustScore: 0,
    publishRate: 0,
    totalProofs: 0,
    activeSince: new Date().toISOString(),
    reputationSummary: [
      { label: "Success rate", value: "0.0%" },
      { label: "Trading yield (30d)", value: "$0.00" },
      { label: "Validation average", value: "0.0%" },
      { label: "Endpoint uptime", value: "No runs yet" }
    ]
  };
  snapshot.logs = {
    execution: [],
    signal: [],
    risk: [],
    publish: [],
    error: [],
    jobs: []
  };
  snapshot.settings = {
    ...snapshot.settings,
    exchange: {
      ...snapshot.settings.exchange,
      apiKey: "",
      apiSecret: "",
      connected: false,
      paperTrading: false,
      accountMode: snapshot.settings.exchange.accountMode ?? "spot",
      futuresLeverage: snapshot.settings.exchange.futuresLeverage ?? 2
    }
  };
  return snapshot;
}

function stripDemoSnapshotData(snapshot: ProofTraderSnapshot): ProofTraderSnapshot {
  const next = deepClone(snapshot);
  next.generatedAt = new Date().toISOString();
  next.trades = next.trades.filter((trade) => !DEMO_TRADE_IDS.has(trade.id));
  next.positions = next.positions.filter((position) => !DEMO_POSITION_IDS.has(position.id));
  next.validation.artifacts = next.validation.artifacts.filter((artifact) => !DEMO_ARTIFACT_IDS.has(artifact.id));
  next.dashboard.openPositionsPreview = next.dashboard.openPositionsPreview.filter((position) => !DEMO_POSITION_IDS.has(position.id));
  next.dashboard.recentTradesPreview = next.dashboard.recentTradesPreview.filter((trade) => !DEMO_TRADE_IDS.has(trade.id));
  next.dashboard.recentArtifacts = next.dashboard.recentArtifacts.filter((artifact) => !DEMO_ARTIFACT_IDS.has(artifact.id));
  next.dashboard.recentSignals = next.dashboard.recentSignals.filter((signal) => !DEMO_SIGNAL_IDS.has(signal.id));
  next.strategy.eventHistory = next.strategy.eventHistory.filter((event) => !DEMO_EVENT_IDS.has(event.id));
  next.strategy.aiCommentary = next.strategy.aiCommentary.filter((item) => !DEMO_AI_COMMENTARY_KEYS.has(`${item.label}|${item.timestamp}|${item.body}`));
  next.risk.checks = next.risk.checks.filter((check) => !DEMO_RISK_CHECK_IDS.has(check.id));
  next.risk.events = next.risk.events.filter((event) => !DEMO_RISK_EVENT_IDS.has(event.id));
  next.logs.execution = next.logs.execution.filter((item) => !DEMO_LOG_IDS.has(item.id));
  next.logs.signal = next.logs.signal.filter((item) => !DEMO_LOG_IDS.has(item.id));
  next.logs.risk = next.logs.risk.filter((item) => !DEMO_LOG_IDS.has(item.id));
  next.logs.publish = next.logs.publish.filter((item) => !DEMO_LOG_IDS.has(item.id));
  next.logs.error = next.logs.error.filter((item) => !DEMO_LOG_IDS.has(item.id));
  next.logs.jobs = next.logs.jobs.filter((item) => !DEMO_JOB_IDS.has(item.id));
  if (next.settings.exchange.apiKey === SEEDED_API_KEY) next.settings.exchange.apiKey = "";
  if (next.settings.exchange.apiSecret === SEEDED_API_SECRET) next.settings.exchange.apiSecret = "";
  if (JSON.stringify(next.dashboard.equityCurve) === JSON.stringify(seedSnapshot.dashboard.equityCurve)) next.dashboard.equityCurve = [];
  if (JSON.stringify(next.strategy.performance) === JSON.stringify(seedSnapshot.strategy.performance)) next.strategy.performance = [];
  if (next.paper.recentOrders.some((order) => DEMO_TRADE_IDS.has(order.id))) next.paper.recentOrders = [];
  next.dashboard.totalTrades = next.trades.length;
  next.paper.tradeCount = Math.max(next.paper.tradeCount, next.trades.length);
  return next;
}

function buildEquityCurve(trades: TradeRecord[], currentEquity: number, openUnrealized: number) {
  const closedTrades = trades
    .filter((trade) => trade.status === "Closed" && trade.closedAt)
    .sort((left, right) => new Date(left.closedAt ?? left.openedAt).getTime() - new Date(right.closedAt ?? right.openedAt).getTime());

  const realizedTotal = closedTrades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const startingEquity = round(Math.max(currentEquity - realizedTotal - openUnrealized, 0), 2);
  const points: Array<{ date: string; value: number }> = [];
  let runningEquity = startingEquity;

  if (closedTrades.length === 0) {
    return currentEquity > 0 ? [{ date: formatChartDate(new Date()), value: round(currentEquity, 2) }] : [];
  }

  points.push({ date: formatChartDate(closedTrades[0].closedAt ?? closedTrades[0].openedAt), value: startingEquity });

  for (const trade of closedTrades) {
    runningEquity = round(runningEquity + trade.realizedPnL, 2);
    points.push({
      date: formatChartDate(trade.closedAt ?? trade.openedAt),
      value: runningEquity
    });
  }

  const todayLabel = formatChartDate(new Date());
  const finalPoint = { date: todayLabel, value: round(currentEquity, 2) };
  const lastPoint = points[points.length - 1];
  if (!lastPoint || lastPoint.date !== finalPoint.date || lastPoint.value !== finalPoint.value) {
    points.push(finalPoint);
  }

  return points.slice(-12);
}

function computeMaxDrawdown(curve: Array<{ date: string; value: number }>) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.value);
    if (peak <= 0) continue;
    const drawdown = ((point.value - peak) / peak) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return round(maxDrawdown, 2);
}

function computeSharpeStyleMetric(curve: Array<{ date: string; value: number }>) {
  if (curve.length < 2) return 0;
  const returns: number[] = [];
  for (let index = 1; index < curve.length; index += 1) {
    const previous = curve[index - 1]?.value ?? 0;
    const current = curve[index]?.value ?? 0;
    if (previous > 0) {
      returns.push((current - previous) / previous);
    }
  }
  if (returns.length === 0) return 0;
  const mean = average(returns);
  const variance = average(returns.map((item) => Math.pow(item - mean, 2)));
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return round(mean * Math.sqrt(returns.length), 2);
  return round((mean / stdDev) * Math.sqrt(returns.length), 2);
}

function buildPerformanceSnapshot(curve: Array<{ date: string; value: number }>) {
  let peak = 0;
  return curve.map((point) => {
    peak = Math.max(peak, point.value);
    const drawdown = peak > 0 ? round(((point.value - peak) / peak) * 100, 2) : 0;
    return {
      date: point.date,
      equity: point.value,
      drawdown
    };
  });
}

class StateStore {
  private workspaceId: string | null = null;
  private priceMemory = new Map<string, number[]>();

  private async ensureWorkspace() {
    if (this.workspaceId) {
      return this.workspaceId;
    }

    let workspace = await prisma.workspace.findUnique({
      where: { slug: DEFAULT_WORKSPACE_SLUG },
      include: { snapshot: true }
    });

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          slug: DEFAULT_WORKSPACE_SLUG,
          name: "ProofTrader Default Workspace"
        },
        include: { snapshot: true }
      });
    }

    this.workspaceId = workspace.id;

    if (!workspace.snapshot) {
      const initialSnapshot = createInitialSnapshot();
      await prisma.workspaceSnapshot.create({
        data: {
          workspaceId: workspace.id,
          data: toJson(initialSnapshot) as never,
          generatedAt: new Date(initialSnapshot.generatedAt)
        }
      });
      return workspace.id;
    }

    const strippedSnapshot = stripDemoSnapshotData(workspace.snapshot.data as unknown as ProofTraderSnapshot);

    await prisma.$transaction([
      prisma.tradeExecution.deleteMany({ where: { workspaceId: workspace.id, id: { in: Array.from(DEMO_TRADE_IDS) } } }),
      prisma.position.deleteMany({ where: { workspaceId: workspace.id, id: { in: Array.from(DEMO_POSITION_IDS) } } }),
      prisma.validationArtifact.deleteMany({ where: { workspaceId: workspace.id, id: { in: Array.from(DEMO_ARTIFACT_IDS) } } }),
      prisma.logEntry.deleteMany({ where: { workspaceId: workspace.id, id: { in: Array.from(DEMO_LOG_IDS) } } }),
      prisma.jobRun.deleteMany({ where: { workspaceId: workspace.id, id: { in: Array.from(DEMO_JOB_IDS) } } })
    ]);

    await prisma.workspaceSnapshot.update({
      where: { workspaceId: workspace.id },
      data: {
        data: toJson(strippedSnapshot) as never,
        generatedAt: new Date(strippedSnapshot.generatedAt)
      }
    });

    return workspace.id;
  }

  private async seedExecutionRecords(workspaceId: string, snapshot: ProofTraderSnapshot) {
    await prisma.tradeExecution.createMany({
      data: snapshot.trades.map((trade) => ({
        id: trade.id,
        workspaceId,
        exchangeOrderId: trade.exchangeOrderId,
        symbol: trade.symbol,
        side: trade.side,
        size: trade.size,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        status: trade.status,
        openedAt: asDate(trade.openedAt) ?? new Date(),
        closedAt: asDate(trade.closedAt),
        realizedPnL: trade.realizedPnL,
        unrealizedPnL: trade.unrealizedPnL,
        fees: trade.fees,
        strategy: trade.strategy,
        signalSummary: trade.signalSummary,
        riskSummary: trade.riskSummary,
        artifactId: trade.artifactId
      })),
      skipDuplicates: true
    });

    await prisma.position.createMany({
      data: snapshot.positions.map((position) => ({
        id: position.id,
        workspaceId,
        linkedTradeId: null,
        symbol: position.symbol,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        unrealizedPnL: position.unrealizedPnL,
        unrealizedPnLPercent: position.unrealizedPnLPercent,
        collateral: position.collateral,
        leverage: position.leverage,
        liquidationPrice: position.liquidationPrice,
        openedAt: asDate(position.openedAt) ?? new Date(),
        riskScore: position.riskScore
      })),
      skipDuplicates: true
    });

    await prisma.validationArtifact.createMany({
      data: snapshot.validation.artifacts.map((artifact) => ({
        id: artifact.id,
        workspaceId,
        tradeId: artifact.tradeId,
        type: artifact.type,
        intentHash: artifact.intentHash,
        signatureStatus: artifact.signatureStatus,
        checkpointStatus: artifact.checkpointStatus,
        onchainReference: artifact.onchainReference,
        validatorStatus: artifact.validatorStatus,
        riskCheckId: artifact.riskCheckId,
        payload: Prisma.DbNull,
        createdAt: asDate(artifact.createdAt) ?? new Date()
      })),
      skipDuplicates: true
    });

    const logs = [
      ...snapshot.logs.execution.map((item) => ({ ...item, stream: "execution" })),
      ...snapshot.logs.signal.map((item) => ({ ...item, stream: "signal" })),
      ...snapshot.logs.risk.map((item) => ({ ...item, stream: "risk" })),
      ...snapshot.logs.publish.map((item) => ({ ...item, stream: "publish" })),
      ...snapshot.logs.error.map((item) => ({ ...item, stream: "error" }))
    ];

    if (logs.length > 0) {
      await prisma.logEntry.createMany({
        data: logs.map((item) => ({
          id: item.id,
          workspaceId,
          stream: item.stream,
          level: item.level,
          message: item.message,
          details: toJson(item.details) as never,
          createdAt: new Date(item.timestamp)
        })),
        skipDuplicates: true
      });
    }

    if (snapshot.logs.jobs.length > 0) {
      await prisma.jobRun.createMany({
        data: snapshot.logs.jobs.map((job) => ({
          id: job.id,
          workspaceId,
          type: job.type,
          status: job.status,
          progress: job.progress,
          startedAt: new Date(job.startedAt),
          completedAt: job.status === "Completed" || job.status === "Failed" ? new Date(job.startedAt) : null,
          payload: Prisma.DbNull,
        })),
        skipDuplicates: true
      });
    }
  }

  private async loadWorkspaceSnapshot() {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await prisma.workspaceSnapshot.findUniqueOrThrow({
      where: { workspaceId }
    });

    return {
      workspaceId,
      snapshot: stripDemoSnapshotData(deepClone(snapshot.data as unknown as ProofTraderSnapshot))
    };
  }

  private async persistSnapshot(workspaceId: string, snapshot: ProofTraderSnapshot) {
    snapshot.generatedAt = new Date().toISOString();
    await prisma.workspaceSnapshot.update({
      where: { workspaceId },
      data: {
        data: toJson(snapshot) as never,
        generatedAt: new Date(snapshot.generatedAt)
      }
    });
  }

  private async appendLog(workspaceId: string, stream: string, level: LogRecord["level"], message: string, details: Record<string, unknown> = {}) {
    await prisma.logEntry.create({
      data: {
        id: generateId("LOG"),
        workspaceId,
        stream,
        level,
        message,
        details: toJson(details) as never
      }
    });
  }

  private async recordJob(workspaceId: string, type: string, status: JobStatus["status"], progress: number, payload: Record<string, unknown> = {}) {
    await prisma.jobRun.create({
      data: {
        id: generateId("JOB"),
        workspaceId,
        type,
        status,
        progress,
        startedAt: new Date(),
        completedAt: status === "Running" ? null : new Date(),
        payload: toJson(payload) as never
      }
    });
  }

  private ensureRunnerState(snapshot: ProofTraderSnapshot) {
    snapshot.risk.policy = normalizeRiskPolicy(snapshot.risk.policy);
    snapshot.settings.exchange.futuresLeverage = Math.min(Math.max(Math.round(snapshot.settings.exchange.futuresLeverage ?? 2), 1), snapshot.risk.policy.futuresMaxLeverage);
    snapshot.strategy.runner = {
      enabled: snapshot.strategy.runner?.enabled ?? false,
      status: snapshot.strategy.runner?.status ?? "Stopped",
      cadenceSeconds: snapshot.strategy.runner?.cadenceSeconds ?? 60,
      confidenceThreshold: clamp(snapshot.strategy.runner?.confidenceThreshold ?? 0.68, 0.5, 0.95),
      tradeSizeUsd: Math.max(snapshot.strategy.runner?.tradeSizeUsd ?? 750, 50),
      maxTradesPerDay: Math.max(Math.round(snapshot.strategy.runner?.maxTradesPerDay ?? 4), 1),
      cooldownAfterLosses: Math.max(Math.round(snapshot.strategy.runner?.cooldownAfterLosses ?? snapshot.risk.policy.cooldownAfterLosses ?? 3), 1),
      lastRunAt: snapshot.strategy.runner?.lastRunAt ?? null,
      lastSignalAt: snapshot.strategy.runner?.lastSignalAt ?? null,
      lastTradeAt: snapshot.strategy.runner?.lastTradeAt ?? null,
      watchedSymbols: snapshot.strategy.runner?.watchedSymbols?.length
        ? snapshot.strategy.runner.watchedSymbols
        : [...snapshot.risk.policy.whitelistedMarkets],
      latestSummary: snapshot.strategy.runner?.latestSummary ?? "Strategy runner is idle."
    };

    snapshot.strategy.ai = {
      enabled: snapshot.strategy.ai?.enabled ?? false,
      provider: snapshot.strategy.ai?.provider ?? "heuristic",
      model: snapshot.strategy.ai?.model ?? "not-configured",
      status: snapshot.strategy.ai?.status ?? "Fallback",
      lastDecisionAt: snapshot.strategy.ai?.lastDecisionAt ?? null,
      recommendedAction: snapshot.strategy.ai?.recommendedAction ?? "HOLD",
      recommendedSymbol: snapshot.strategy.ai?.recommendedSymbol ?? null,
      confidence: snapshot.strategy.ai?.confidence ?? null,
      rationale: snapshot.strategy.ai?.rationale ?? "AI reasoning is not configured yet.",
      riskNote: snapshot.strategy.ai?.riskNote ?? "Risk checks remain the final authority.",
      error: snapshot.strategy.ai?.error ?? null,
      selectedCandidateId: snapshot.strategy.ai?.selectedCandidateId ?? null,
      strategyModule: snapshot.strategy.ai?.strategyModule ?? null,
      executionBias: snapshot.strategy.ai?.executionBias ?? null,
      sizeMultiplier: snapshot.strategy.ai?.sizeMultiplier ?? null,
      stopLossPercent: snapshot.strategy.ai?.stopLossPercent ?? null,
      takeProfitPercent: snapshot.strategy.ai?.takeProfitPercent ?? null,
      rankingSummary: snapshot.strategy.ai?.rankingSummary ?? null,
      futuresThrottle: snapshot.strategy.ai?.futuresThrottle ?? null,
      futuresDefense: snapshot.strategy.ai?.futuresDefense ?? null,
      positionExitEngine: snapshot.strategy.ai?.positionExitEngine ?? null,
      portfolioAllocation: snapshot.strategy.ai?.portfolioAllocation ?? null
    };
    snapshot.strategy.selectedStrategy = "AI Regime & Execution Strategist";
  }

  private rememberPrice(symbol: string, price: number) {
    const history = [...(this.priceMemory.get(symbol) ?? []), price].slice(-12);
    this.priceMemory.set(symbol, history);
    return history;
  }

  private buildMarketContext(symbol: string, price: number, candles5m: OhlcCandle[], candles15m: OhlcCandle[], candles1h: OhlcCandle[], depth: DepthMetrics): MarketContext {
    const atr5mPercent = round(computeAtrPercent(candles5m), 3);
    const atr15mPercent = round(computeAtrPercent(candles15m), 3);
    const atr1hPercent = round(computeAtrPercent(candles1h), 3);
    const trend15mPercent = round(computeTrendPercent(candles15m, 5, 14), 3);
    const trend1hPercent = round(computeTrendPercent(candles1h, 6, 20), 3);
    const momentum5mPercent = round(computeMomentumPercent(candles5m, 3), 3);
    const mediumMomentumPercent = round(computeMomentumPercent(candles15m, 3), 3);
    const realizedVolatilityPercent = round(standardDeviation(returnSeries(closeSeries(candles15m))), 3);
    const rangePosition5m = round(computeRangePositionFromCandles(candles5m), 3);
    const rangePosition15m = round(computeRangePositionFromCandles(candles15m), 3);
    const breakoutPressure = round(computeBreakoutPressure(candles5m, rangePosition5m), 3);
    const meanReversionStretch = round(computeStretchScore(candles5m), 3);

    const context: MarketContext = {
      symbol,
      price,
      atr5mPercent,
      atr15mPercent,
      atr1hPercent,
      trend15mPercent,
      trend1hPercent,
      momentum5mPercent,
      mediumMomentumPercent,
      realizedVolatilityPercent,
      rangePosition5m,
      rangePosition15m,
      breakoutPressure,
      meanReversionStretch,
      regime: "Transition",
      executionQuality: round(depth.executionQuality, 3),
      liquidityUsd: round(depth.totalDepthUsd, 2),
      spreadPercent: round(depth.spreadPercent, 4),
      spreadBps: round(depth.spreadBps, 2),
      bookImbalance: round(depth.imbalance, 3),
      topLevelLiquidityUsd: round(depth.topLevelLiquidityUsd, 2),
      candles5m,
      candles15m,
      candles1h
    };

    context.regime = inferMarketRegime(context);
    return context;
  }

  private buildExecutionAwareCandidates(symbol: string, context: MarketContext): { observation: StrategyObservation; candidates: StrategyCandidate[] } {
    const candidates: StrategyCandidate[] = [];
    const atrPercent = Math.max(context.atr15mPercent || context.atr5mPercent, 0.45);
    const spreadPenalty = Math.max(0, context.spreadBps - 5) * 0.006;
    const liquidityBoost = clamp(context.liquidityUsd / 225000, 0, 1) * 0.08;

    const addCandidate = (candidate: Omit<StrategyCandidate, "id" | "symbol" | "price">) => {
      candidates.push({
        id: generateId("CAND"),
        symbol,
        price: context.price,
        ...candidate,
        confidence: round(clamp(candidate.confidence, 0.5, 0.95), 2),
        momentumPercent: round(candidate.momentumPercent, 3),
        mediumMomentumPercent: round(candidate.mediumMomentumPercent, 3),
        spreadPercent: round(candidate.spreadPercent, 4),
        volatilityPercent: round(candidate.volatilityPercent, 3),
        rangePosition: round(candidate.rangePosition, 3),
        stopLossPercent: round(clamp(candidate.stopLossPercent, 0.6, 2.2), 2),
        takeProfitPercent: round(clamp(candidate.takeProfitPercent, 1.2, 4.5), 2),
        sizeMultiplier: round(clamp(candidate.sizeMultiplier, 0.55, 1.25), 2),
        atrPercent: round(candidate.atrPercent, 3),
        trend1hPercent: round(candidate.trend1hPercent, 3),
        trend15mPercent: round(candidate.trend15mPercent, 3),
        spreadBps: round(candidate.spreadBps, 2),
        bookImbalance: round(candidate.bookImbalance, 3),
        liquidityUsd: round(candidate.liquidityUsd, 2),
        executionQuality: round(candidate.executionQuality, 3)
      });
    };

    const bullishAlignment = context.trend1hPercent > 0.18 && context.trend15mPercent > 0.08;
    const bearishAlignment = context.trend1hPercent < -0.18 && context.trend15mPercent < -0.08;
    const rangeFriendly = context.regime === "Range" || (Math.abs(context.trend1hPercent) < 0.18 && Math.abs(context.trend15mPercent) < 0.14);

    if (bullishAlignment && context.momentum5mPercent > -0.18 && context.rangePosition5m >= 0.28 && context.executionQuality >= 0.48) {
      const confidence = 0.58 + Math.abs(context.trend1hPercent) * 0.12 + Math.abs(context.trend15mPercent) * 0.25 + context.executionQuality * 0.16 + liquidityBoost - spreadPenalty;
      const stopLossPercent = clamp(Math.max(atrPercent * 1.15, 0.72), 0.72, 2.1);
      addCandidate({
        action: "LONG",
        confidence,
        type: "TREND_CONTINUATION",
        module: "Trend Continuation",
        regime: context.regime,
        summary: `Trend continuation long. 1h trend ${context.trend1hPercent.toFixed(2)}%, 15m trend ${context.trend15mPercent.toFixed(2)}%, spread ${context.spreadBps.toFixed(1)} bps, execution quality ${(context.executionQuality * 100).toFixed(0)}%.`,
        momentumPercent: context.momentum5mPercent,
        mediumMomentumPercent: context.mediumMomentumPercent,
        spreadPercent: context.spreadPercent,
        volatilityPercent: context.realizedVolatilityPercent,
        rangePosition: context.rangePosition5m,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.2,
        sizeMultiplier: 0.95 + context.executionQuality * 0.18,
        expectedHoldMinutes: 240,
        atrPercent,
        trend1hPercent: context.trend1hPercent,
        trend15mPercent: context.trend15mPercent,
        spreadBps: context.spreadBps,
        bookImbalance: context.bookImbalance,
        liquidityUsd: context.liquidityUsd,
        executionQuality: context.executionQuality
      });
    }

    if (bearishAlignment && context.momentum5mPercent < 0.18 && context.rangePosition5m <= 0.72 && context.executionQuality >= 0.48) {
      const confidence = 0.58 + Math.abs(context.trend1hPercent) * 0.12 + Math.abs(context.trend15mPercent) * 0.25 + context.executionQuality * 0.16 + liquidityBoost - spreadPenalty;
      const stopLossPercent = clamp(Math.max(atrPercent * 1.15, 0.72), 0.72, 2.1);
      addCandidate({
        action: "SHORT",
        confidence,
        type: "TREND_CONTINUATION",
        module: "Trend Continuation",
        regime: context.regime,
        summary: `Trend continuation short. 1h trend ${context.trend1hPercent.toFixed(2)}%, 15m trend ${context.trend15mPercent.toFixed(2)}%, spread ${context.spreadBps.toFixed(1)} bps, execution quality ${(context.executionQuality * 100).toFixed(0)}%.`,
        momentumPercent: context.momentum5mPercent,
        mediumMomentumPercent: context.mediumMomentumPercent,
        spreadPercent: context.spreadPercent,
        volatilityPercent: context.realizedVolatilityPercent,
        rangePosition: context.rangePosition5m,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.2,
        sizeMultiplier: 0.95 + context.executionQuality * 0.18,
        expectedHoldMinutes: 240,
        atrPercent,
        trend1hPercent: context.trend1hPercent,
        trend15mPercent: context.trend15mPercent,
        spreadBps: context.spreadBps,
        bookImbalance: context.bookImbalance,
        liquidityUsd: context.liquidityUsd,
        executionQuality: context.executionQuality
      });
    }

    const breakoutLong = context.breakoutPressure > 0.72 && context.rangePosition5m > 0.82 && context.bookImbalance > -0.12 && context.executionQuality >= 0.55;
    const breakoutShort = context.breakoutPressure > 0.72 && context.rangePosition5m < 0.18 && context.bookImbalance < 0.12 && context.executionQuality >= 0.55;
    if (breakoutLong && context.regime !== "Risk Off") {
      const confidence = 0.57 + context.breakoutPressure * 0.16 + Math.max(context.trend15mPercent, 0) * 0.18 + context.executionQuality * 0.14 + liquidityBoost - spreadPenalty;
      const stopLossPercent = clamp(Math.max(context.atr5mPercent * 1.05, 0.62), 0.62, 1.7);
      addCandidate({
        action: "LONG",
        confidence,
        type: "BREAKOUT_EXPANSION",
        module: "Breakout Expansion",
        regime: context.regime,
        summary: `Breakout expansion long. 5m range position ${context.rangePosition5m.toFixed(2)}, breakout pressure ${(context.breakoutPressure * 100).toFixed(0)}%, book imbalance ${context.bookImbalance.toFixed(2)}.`,
        momentumPercent: context.momentum5mPercent,
        mediumMomentumPercent: context.mediumMomentumPercent,
        spreadPercent: context.spreadPercent,
        volatilityPercent: context.realizedVolatilityPercent,
        rangePosition: context.rangePosition5m,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.4,
        sizeMultiplier: 0.9 + context.executionQuality * 0.2,
        expectedHoldMinutes: 120,
        atrPercent: context.atr5mPercent,
        trend1hPercent: context.trend1hPercent,
        trend15mPercent: context.trend15mPercent,
        spreadBps: context.spreadBps,
        bookImbalance: context.bookImbalance,
        liquidityUsd: context.liquidityUsd,
        executionQuality: context.executionQuality
      });
    }
    if (breakoutShort && context.regime !== "Risk Off") {
      const confidence = 0.57 + context.breakoutPressure * 0.16 + Math.max(-context.trend15mPercent, 0) * 0.18 + context.executionQuality * 0.14 + liquidityBoost - spreadPenalty;
      const stopLossPercent = clamp(Math.max(context.atr5mPercent * 1.05, 0.62), 0.62, 1.7);
      addCandidate({
        action: "SHORT",
        confidence,
        type: "BREAKOUT_EXPANSION",
        module: "Breakout Expansion",
        regime: context.regime,
        summary: `Breakout expansion short. 5m range position ${context.rangePosition5m.toFixed(2)}, breakout pressure ${(context.breakoutPressure * 100).toFixed(0)}%, book imbalance ${context.bookImbalance.toFixed(2)}.`,
        momentumPercent: context.momentum5mPercent,
        mediumMomentumPercent: context.mediumMomentumPercent,
        spreadPercent: context.spreadPercent,
        volatilityPercent: context.realizedVolatilityPercent,
        rangePosition: context.rangePosition5m,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.4,
        sizeMultiplier: 0.9 + context.executionQuality * 0.2,
        expectedHoldMinutes: 120,
        atrPercent: context.atr5mPercent,
        trend1hPercent: context.trend1hPercent,
        trend15mPercent: context.trend15mPercent,
        spreadBps: context.spreadBps,
        bookImbalance: context.bookImbalance,
        liquidityUsd: context.liquidityUsd,
        executionQuality: context.executionQuality
      });
    }

    if (rangeFriendly && context.executionQuality >= 0.5 && context.spreadBps <= 12) {
      if (context.meanReversionStretch <= -0.95 && context.rangePosition5m < 0.24) {
        const confidence = 0.55 + Math.min(Math.abs(context.meanReversionStretch) * 0.08, 0.16) + context.executionQuality * 0.12 + liquidityBoost - spreadPenalty;
        const stopLossPercent = clamp(Math.max(context.atr5mPercent * 0.9, 0.58), 0.58, 1.25);
        addCandidate({
          action: "LONG",
          confidence,
          type: "MEAN_REVERSION",
          module: "Mean Reversion",
          regime: context.regime,
          summary: `Mean reversion long. Stretch ${context.meanReversionStretch.toFixed(2)}σ, range position ${context.rangePosition5m.toFixed(2)}, execution quality ${(context.executionQuality * 100).toFixed(0)}%.`,
          momentumPercent: context.momentum5mPercent,
          mediumMomentumPercent: context.mediumMomentumPercent,
          spreadPercent: context.spreadPercent,
          volatilityPercent: context.realizedVolatilityPercent,
          rangePosition: context.rangePosition5m,
          stopLossPercent,
          takeProfitPercent: stopLossPercent * 1.7,
          sizeMultiplier: 0.7 + context.executionQuality * 0.12,
          expectedHoldMinutes: 75,
          atrPercent: context.atr5mPercent,
          trend1hPercent: context.trend1hPercent,
          trend15mPercent: context.trend15mPercent,
          spreadBps: context.spreadBps,
          bookImbalance: context.bookImbalance,
          liquidityUsd: context.liquidityUsd,
          executionQuality: context.executionQuality
        });
      }
      if (context.meanReversionStretch >= 0.95 && context.rangePosition5m > 0.76) {
        const confidence = 0.55 + Math.min(Math.abs(context.meanReversionStretch) * 0.08, 0.16) + context.executionQuality * 0.12 + liquidityBoost - spreadPenalty;
        const stopLossPercent = clamp(Math.max(context.atr5mPercent * 0.9, 0.58), 0.58, 1.25);
        addCandidate({
          action: "SHORT",
          confidence,
          type: "MEAN_REVERSION",
          module: "Mean Reversion",
          regime: context.regime,
          summary: `Mean reversion short. Stretch ${context.meanReversionStretch.toFixed(2)}σ, range position ${context.rangePosition5m.toFixed(2)}, execution quality ${(context.executionQuality * 100).toFixed(0)}%.`,
          momentumPercent: context.momentum5mPercent,
          mediumMomentumPercent: context.mediumMomentumPercent,
          spreadPercent: context.spreadPercent,
          volatilityPercent: context.realizedVolatilityPercent,
          rangePosition: context.rangePosition5m,
          stopLossPercent,
          takeProfitPercent: stopLossPercent * 1.7,
          sizeMultiplier: 0.7 + context.executionQuality * 0.12,
          expectedHoldMinutes: 75,
          atrPercent: context.atr5mPercent,
          trend1hPercent: context.trend1hPercent,
          trend15mPercent: context.trend15mPercent,
          spreadBps: context.spreadBps,
          bookImbalance: context.bookImbalance,
          liquidityUsd: context.liquidityUsd,
          executionQuality: context.executionQuality
        });
      }
    }

    candidates.sort((left, right) => right.confidence - left.confidence);
    const lead = candidates[0] ?? null;
    const observation: StrategyObservation = lead ? {
      action: lead.action,
      type: lead.type,
      confidence: lead.confidence,
      summary: lead.summary,
      regime: context.regime,
      spreadPercent: lead.spreadPercent,
      momentumPercent: lead.momentumPercent,
      candidateCount: candidates.length,
      executionQuality: context.executionQuality,
      atrPercent: context.atr15mPercent
    } : {
      action: "HOLD",
      type: "OBSERVATION",
      confidence: round(clamp(0.5 + context.executionQuality * 0.18 - spreadPenalty, 0.5, 0.72), 2),
      summary: `No bounded setup. Regime ${context.regime}, 1h trend ${context.trend1hPercent.toFixed(2)}%, 15m trend ${context.trend15mPercent.toFixed(2)}%, spread ${context.spreadBps.toFixed(1)} bps.`,
      regime: context.regime,
      spreadPercent: context.spreadPercent,
      momentumPercent: context.momentum5mPercent,
      candidateCount: 0,
      executionQuality: context.executionQuality,
      atrPercent: context.atr15mPercent
    };

    return { observation, candidates };
  }

  private buildStrategyCandidates(symbol: string, history: number[]): { observation: StrategyObservation; candidates: StrategyCandidate[] } {
    const latest = history[history.length - 1] ?? 0;
    const fastWindow = history.slice(-3);
    const mediumWindow = history.slice(-5);
    const slowWindow = history.slice(-8);
    const fastAverage = average(fastWindow.length > 0 ? fastWindow : history);
    const mediumAverage = average(mediumWindow.length > 0 ? mediumWindow : history);
    const slowAverage = average(slowWindow.length > 0 ? slowWindow : history);
    const shortBaseline = history[Math.max(history.length - 4, 0)] ?? latest;
    const mediumBaseline = history[Math.max(history.length - 7, 0)] ?? shortBaseline;
    const momentumPercent = shortBaseline === 0 ? 0 : ((latest - shortBaseline) / shortBaseline) * 100;
    const mediumMomentumPercent = mediumBaseline === 0 ? 0 : ((latest - mediumBaseline) / mediumBaseline) * 100;
    const spreadPercent = slowAverage === 0 ? 0 : ((fastAverage - slowAverage) / slowAverage) * 100;
    const returns = history.slice(1).map((price, index) => {
      const base = history[index];
      return base === 0 ? 0 : ((price - base) / base) * 100;
    });
    const volatilityPercent = standardDeviation(returns);
    const rangeLow = history.length > 0 ? Math.min(...history) : latest;
    const rangeHigh = history.length > 0 ? Math.max(...history) : latest;
    const rangeSpan = rangeHigh - rangeLow;
    const rangePosition = rangeSpan <= 0 ? 0.5 : (latest - rangeLow) / rangeSpan;
    const pullbackPercent = fastAverage === 0 ? 0 : ((latest - fastAverage) / fastAverage) * 100;
    const candidates: StrategyCandidate[] = [];

    const addCandidate = (candidate: Omit<StrategyCandidate, "id" | "symbol" | "price" | "atrPercent" | "trend1hPercent" | "trend15mPercent" | "spreadBps" | "bookImbalance" | "liquidityUsd" | "executionQuality">) => {
      candidates.push({
        id: generateId("CAND"),
        symbol,
        price: latest,
        ...candidate,
        confidence: round(clamp(candidate.confidence, 0.5, 0.95), 2),
        momentumPercent: round(candidate.momentumPercent, 3),
        mediumMomentumPercent: round(candidate.mediumMomentumPercent, 3),
        spreadPercent: round(candidate.spreadPercent, 3),
        volatilityPercent: round(candidate.volatilityPercent, 3),
        rangePosition: round(candidate.rangePosition, 3),
        stopLossPercent: round(clamp(candidate.stopLossPercent, 0.6, 2.0), 2),
        takeProfitPercent: round(clamp(candidate.takeProfitPercent, 1.2, 4.0), 2),
        sizeMultiplier: round(clamp(candidate.sizeMultiplier, 0.6, 1.25), 2),
        atrPercent: round(volatilityPercent, 3),
        trend1hPercent: round(spreadPercent, 3),
        trend15mPercent: round(mediumMomentumPercent, 3),
        spreadBps: round(Math.abs(spreadPercent) * 100, 2),
        bookImbalance: 0,
        liquidityUsd: 0,
        executionQuality: 0.45
      });
    };

    const trendLong = fastAverage > mediumAverage && mediumAverage > slowAverage && mediumMomentumPercent > 0.12 && rangePosition > 0.32;
    const trendShort = fastAverage < mediumAverage && mediumAverage < slowAverage && mediumMomentumPercent < -0.12 && rangePosition < 0.68;
    const trendStrength = Math.abs(spreadPercent) + Math.abs(mediumMomentumPercent);
    if (trendLong) {
      const confidence = 0.55 + Math.abs(spreadPercent) * 0.8 + Math.abs(mediumMomentumPercent) * 0.28 - volatilityPercent * 0.05 + (pullbackPercent <= 0 ? 0.05 : 0);
      const stopLossPercent = clamp(0.75 + volatilityPercent * 1.8, 0.7, 1.6);
      addCandidate({
        action: "LONG",
        confidence,
        type: "TREND_CONTINUATION",
        module: "Trend Continuation",
        regime: "Bull Trend",
        summary: `Trend continuation long. Fast trend is above slow trend with ${mediumMomentumPercent.toFixed(2)}% medium momentum and ${spreadPercent.toFixed(2)}% spread alignment.`,
        momentumPercent,
        mediumMomentumPercent,
        spreadPercent,
        volatilityPercent,
        rangePosition,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.2,
        sizeMultiplier: pullbackPercent <= 0 ? 1.05 : 0.95,
        expectedHoldMinutes: 180
      });
    }
    if (trendShort) {
      const confidence = 0.55 + Math.abs(spreadPercent) * 0.8 + Math.abs(mediumMomentumPercent) * 0.28 - volatilityPercent * 0.05 + (pullbackPercent >= 0 ? 0.05 : 0);
      const stopLossPercent = clamp(0.75 + volatilityPercent * 1.8, 0.7, 1.6);
      addCandidate({
        action: "SHORT",
        confidence,
        type: "TREND_CONTINUATION",
        module: "Trend Continuation",
        regime: "Bear Trend",
        summary: `Trend continuation short. Fast trend is below slow trend with ${mediumMomentumPercent.toFixed(2)}% medium momentum and ${spreadPercent.toFixed(2)}% spread alignment.`,
        momentumPercent,
        mediumMomentumPercent,
        spreadPercent,
        volatilityPercent,
        rangePosition,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.2,
        sizeMultiplier: pullbackPercent >= 0 ? 1.05 : 0.95,
        expectedHoldMinutes: 180
      });
    }

    const breakoutLong = rangePosition > 0.84 && momentumPercent > 0.18 && spreadPercent > 0.05;
    const breakoutShort = rangePosition < 0.16 && momentumPercent < -0.18 && spreadPercent < -0.05;
    if (breakoutLong) {
      const confidence = 0.54 + Math.abs(momentumPercent) * 0.35 + Math.abs(spreadPercent) * 0.75 + Math.max(rangePosition - 0.84, 0) * 0.2 - volatilityPercent * 0.03;
      const stopLossPercent = clamp(0.65 + volatilityPercent * 1.3, 0.6, 1.3);
      addCandidate({
        action: "LONG",
        confidence,
        type: "BREAKOUT_EXPANSION",
        module: "Breakout Expansion",
        regime: "Risk On Breakout",
        summary: `Breakout expansion long. Price is pressing the top of the recent range with ${momentumPercent.toFixed(2)}% short momentum.`,
        momentumPercent,
        mediumMomentumPercent,
        spreadPercent,
        volatilityPercent,
        rangePosition,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.6,
        sizeMultiplier: 1.1,
        expectedHoldMinutes: 120
      });
    }
    if (breakoutShort) {
      const confidence = 0.54 + Math.abs(momentumPercent) * 0.35 + Math.abs(spreadPercent) * 0.75 + Math.max(0.16 - rangePosition, 0) * 0.2 - volatilityPercent * 0.03;
      const stopLossPercent = clamp(0.65 + volatilityPercent * 1.3, 0.6, 1.3);
      addCandidate({
        action: "SHORT",
        confidence,
        type: "BREAKOUT_EXPANSION",
        module: "Breakout Expansion",
        regime: "Risk Off Breakdown",
        summary: `Breakout expansion short. Price is pressing the bottom of the recent range with ${momentumPercent.toFixed(2)}% short momentum.`,
        momentumPercent,
        mediumMomentumPercent,
        spreadPercent,
        volatilityPercent,
        rangePosition,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 2.6,
        sizeMultiplier: 1.1,
        expectedHoldMinutes: 120
      });
    }

    const rangeMarket = Math.abs(spreadPercent) < 0.22;
    const meanReversionLong = rangeMarket && rangePosition < 0.18 && momentumPercent < -0.08;
    const meanReversionShort = rangeMarket && rangePosition > 0.82 && momentumPercent > 0.08;
    if (meanReversionLong) {
      const confidence = 0.53 + Math.abs(momentumPercent) * 0.32 + Math.max(0.18 - rangePosition, 0) * 0.35 - volatilityPercent * 0.02;
      const stopLossPercent = clamp(0.6 + volatilityPercent, 0.6, 1.0);
      addCandidate({
        action: "LONG",
        confidence,
        type: "MEAN_REVERSION",
        module: "Mean Reversion",
        regime: "Range Reversal",
        summary: `Mean reversion long. Price is stretched into the lower end of the range while the broader spread remains contained.`,
        momentumPercent,
        mediumMomentumPercent,
        spreadPercent,
        volatilityPercent,
        rangePosition,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 1.7,
        sizeMultiplier: 0.8,
        expectedHoldMinutes: 90
      });
    }
    if (meanReversionShort) {
      const confidence = 0.53 + Math.abs(momentumPercent) * 0.32 + Math.max(rangePosition - 0.82, 0) * 0.35 - volatilityPercent * 0.02;
      const stopLossPercent = clamp(0.6 + volatilityPercent, 0.6, 1.0);
      addCandidate({
        action: "SHORT",
        confidence,
        type: "MEAN_REVERSION",
        module: "Mean Reversion",
        regime: "Range Reversal",
        summary: `Mean reversion short. Price is stretched into the upper end of the range while the broader spread remains contained.`,
        momentumPercent,
        mediumMomentumPercent,
        spreadPercent,
        volatilityPercent,
        rangePosition,
        stopLossPercent,
        takeProfitPercent: stopLossPercent * 1.7,
        sizeMultiplier: 0.8,
        expectedHoldMinutes: 90
      });
    }

    candidates.sort((left, right) => right.confidence - left.confidence);
    const lead = candidates[0] ?? null;
    const observation: StrategyObservation = lead
      ? {
          action: lead.action,
          type: lead.type,
          confidence: lead.confidence,
          summary: lead.summary,
          regime: lead.regime,
          spreadPercent: lead.spreadPercent,
          momentumPercent: lead.momentumPercent,
          candidateCount: candidates.length
        }
      : {
          action: "HOLD",
          type: history.length < 5 ? "WARMUP" : "OBSERVATION",
          confidence: round(clamp(0.5 + trendStrength * 0.08, 0.5, 0.72), 2),
          summary: history.length < 5
            ? `Warmup only. ${symbol} needs a few more data points before the AI engine can score bounded candidates.`
            : `No bounded setup. Spread ${spreadPercent.toFixed(2)}%, short momentum ${momentumPercent.toFixed(2)}%, volatility ${volatilityPercent.toFixed(2)}%.`,
          regime: history.length < 5 ? "Warmup" : rangeMarket ? "Range" : spreadPercent >= 0 ? "Uptrend Watch" : "Downtrend Watch",
          spreadPercent: round(spreadPercent, 3),
          momentumPercent: round(momentumPercent, 3),
          candidateCount: 0
        };

    return { observation, candidates };
  }

  private correlatedBucket(symbol: string) {
    return correlatedBucket(symbol);
  }

  private hasCorrelatedExposure(snapshot: ProofTraderSnapshot, symbol: string, side: "LONG" | "SHORT") {
    const bucket = this.correlatedBucket(symbol);
    return snapshot.positions.some((position) => position.symbol !== symbol && position.side === side && this.correlatedBucket(position.symbol) === bucket);
  }

  private getStrategyExecutionBlocker(
    snapshot: ProofTraderSnapshot,
    candidate: StrategyCandidate,
    context: MarketContext,
    orderPreview: {
      notional: number;
      accountMode: ExchangeAccountMode;
      leverage: number;
      liquidationDistancePercent: number | null;
    }
  ) {
    const policy = snapshot.risk.policy;
    if (context.spreadPercent > policy.spreadGuardrailPercent) {
      return `Spread ${context.spreadPercent.toFixed(3)}% is above the ${policy.spreadGuardrailPercent.toFixed(3)}% guardrail.`;
    }
    if (context.executionQuality < 0.45) {
      return `Execution quality ${(context.executionQuality * 100).toFixed(0)}% is too weak for a professional entry.`;
    }
    if (context.topLevelLiquidityUsd < orderPreview.notional * 1.25 || context.liquidityUsd < orderPreview.notional * 6) {
      return `Order book liquidity is too thin for a ${orderPreview.notional.toFixed(2)} USD ticket.`;
    }
    if (this.hasCorrelatedExposure(snapshot, candidate.symbol, candidate.action)) {
      return `Correlated ${candidate.action} exposure is already open in the ${this.correlatedBucket(candidate.symbol)} bucket.`;
    }
    if (Math.abs(context.bookImbalance) > 0.55 && ((candidate.action === "LONG" && context.bookImbalance < 0) || (candidate.action === "SHORT" && context.bookImbalance > 0))) {
      return `Order-book imbalance ${context.bookImbalance.toFixed(2)} is adverse to a ${candidate.action} entry.`;
    }
    if (orderPreview.accountMode === "futures") {
      if (orderPreview.leverage > policy.futuresMaxLeverage) {
        return `Leverage ${orderPreview.leverage}x is above the futures cap of ${policy.futuresMaxLeverage}x.`;
      }
      if ((orderPreview.liquidationDistancePercent ?? 0) < policy.futuresMinLiquidationDistancePercent) {
        return `Liquidation buffer ${(orderPreview.liquidationDistancePercent ?? 0).toFixed(2)}% is below the ${policy.futuresMinLiquidationDistancePercent.toFixed(2)}% futures minimum.`;
      }
    }
    return null;
  }

  private computeStrategyOrder(
    symbol: string,
    side: "LONG" | "SHORT",
    price: number,
    snapshot: ProofTraderSnapshot,
    tuning?: {
      sizeMultiplier?: number | null;
      stopLossPercent?: number | null;
      takeProfitPercent?: number | null;
      atrPercent?: number | null;
      executionQuality?: number | null;
      liquidityUsd?: number | null;
      volatilityPercent?: number | null;
      requestedLeverage?: number | null;
    }
  ) {
    const policy = snapshot.risk.policy;
    const accountMode = snapshot.settings.exchange.accountMode ?? "spot";
    const availableBalanceCard = snapshot.dashboard.metricCards.find((card) => card.label === "Available Balance");
    const equityCard = snapshot.dashboard.metricCards.find((card) => card.label === "Total Equity");
    const availableBalance = Math.max(snapshot.paper.balance, availableBalanceCard?.value ?? 0, 0);
    const totalEquity = Math.max(snapshot.paper.equity, equityCard?.value ?? availableBalance, availableBalance);
    const drawdownPenalty = clamp(1 - currentDrawdownPercent(snapshot) / 20, 0.55, 1);
    const riskBudget = totalEquity * (policy.perTradeRiskPercent / 100) * drawdownPenalty;
    const sizeMultiplier = clamp(tuning?.sizeMultiplier ?? 1, 0.55, 1.25);
    const executionQuality = clamp(tuning?.executionQuality ?? 0.8, 0.4, 1.15);
    const rawAtrPercent = clamp(tuning?.atrPercent ?? 1.1, 0.45, 4);
    const rawVolatilityPercent = clamp(tuning?.volatilityPercent ?? rawAtrPercent, 0.35, 8);
    const atrPercent = rawAtrPercent / 100;
    const requestedStopDistancePercent = clamp((tuning?.stopLossPercent ?? rawAtrPercent * 1.15) / 100, 0.006, accountMode === "futures" ? 0.04 : 0.025);
    const volatilityPenalty = clamp(0.014 / Math.max(atrPercent, 0.0045), 0.5, 1.15);

    let leverage = 1;
    if (accountMode === "futures") {
      const requestedLeverage = Math.min(
        Math.max(Math.round(tuning?.requestedLeverage ?? snapshot.settings.exchange.futuresLeverage ?? 2), 1),
        policy.futuresMaxLeverage
      );
      const volatilityCap = rawVolatilityPercent >= 2.4 ? 1 : rawVolatilityPercent >= 1.8 ? 2 : rawVolatilityPercent >= 1.2 ? 3 : requestedLeverage;
      leverage = Math.min(requestedLeverage, volatilityCap);
      if (executionQuality < 0.62) {
        leverage = Math.min(leverage, 2);
      }
      if (currentDrawdownPercent(snapshot) >= policy.futuresMaxDrawdownPercent * 0.65) {
        leverage = Math.min(leverage, 2);
      }
      leverage = Math.max(leverage, 1);
    }

    let stopDistancePercent = Math.max(requestedStopDistancePercent, atrPercent * (accountMode === "futures" ? 0.9 : 0.8));
    let liquidationPrice = calculateLiquidationPrice(price, side, leverage, accountMode);
    let liquidationDistancePercent = calculateLiquidationDistancePercent(price, liquidationPrice);

    if (accountMode === "futures") {
      while (leverage > 1 && (liquidationDistancePercent ?? 0) < policy.futuresMinLiquidationDistancePercent) {
        leverage -= 1;
        liquidationPrice = calculateLiquidationPrice(price, side, leverage, accountMode);
        liquidationDistancePercent = calculateLiquidationDistancePercent(price, liquidationPrice);
      }
      const safeStopCap = Math.max(((liquidationDistancePercent ?? policy.futuresMinLiquidationDistancePercent) - 2.5) / 100, 0.005);
      stopDistancePercent = Math.min(stopDistancePercent, safeStopCap);
      stopDistancePercent = Math.max(stopDistancePercent, 0.005);
    }

    const takeProfitPercent = clamp((tuning?.takeProfitPercent ?? Math.max(stopDistancePercent * 220, accountMode === "futures" ? 1.6 : 1.8)) / 100, Math.max(stopDistancePercent * 1.5, 0.012), 0.05);
    const notionalFromRisk = riskBudget / Math.max(stopDistancePercent, 0.001);
    const configuredNotional = Math.max(snapshot.strategy.runner.tradeSizeUsd * sizeMultiplier * executionQuality * volatilityPenalty, 0);
    const liquidityCap = tuning?.liquidityUsd ? tuning.liquidityUsd * 0.08 : Number.POSITIVE_INFINITY;
    const capitalCap = accountMode === "futures" ? availableBalance * leverage * 0.45 : availableBalance;
    const instrumentCap = accountMode === "futures" ? policy.futuresMaxPositionNotionalUsd : policy.maxPositionSizeUsd;
    const cappedNotional = Math.min(configuredNotional, instrumentCap, capitalCap, notionalFromRisk, liquidityCap);
    const rawSize = price === 0 ? 0 : cappedNotional / price;
    const size = round(rawSize, price >= 1000 ? 6 : 4);
    const notional = round(size * price, 2);
    const collateral = round(accountMode === "futures" ? notional / Math.max(leverage, 1) : notional, 2);
    const stopLoss = round(price * (side === "LONG" ? 1 - stopDistancePercent : 1 + stopDistancePercent), 2);
    const takeProfit = round(price * (side === "LONG" ? 1 + takeProfitPercent : 1 - takeProfitPercent), 2);
    liquidationPrice = calculateLiquidationPrice(price, side, leverage, accountMode);
    liquidationDistancePercent = calculateLiquidationDistancePercent(price, liquidationPrice);

    return {
      size,
      stopLoss,
      takeProfit,
      notional,
      collateral,
      leverage,
      accountMode,
      liquidationPrice,
      liquidationDistancePercent,
      stopDistancePercent: round(stopDistancePercent * 100, 2),
      takeProfitPercent: round(takeProfitPercent * 100, 2),
      sizeMultiplier: round(sizeMultiplier, 2),
      executionQuality: round(executionQuality, 2),
      atrPercent: round(atrPercent * 100, 2),
      symbol
    };
  }

  private async reconcilePaperState(
    workspaceId: string,
    snapshot: ProofTraderSnapshot,
    options: { persist?: boolean; logErrors?: boolean } = {}
  ) {
    const mode = snapshot.settings.exchange.accountMode ?? "spot";
    const leverage = accountLeverage(mode, Math.min(snapshot.settings.exchange.futuresLeverage, snapshot.risk.policy.futuresMaxLeverage));

    if (!snapshot.settings.exchange.connected || !snapshot.settings.exchange.paperTrading) {
      snapshot.paper.status = "idle";
      snapshot.paper.initialized = false;
      snapshot.paper.lastError = null;
      snapshot.system.connections.lastSyncLabel = formatSyncLabel(snapshot.paper.syncedAt ? new Date(snapshot.paper.syncedAt) : null);
      if (options.persist) {
        await this.persistSnapshot(workspaceId, snapshot);
      }
      return { snapshot, error: null as string | null };
    }

    try {
      const [statusPayload, balancePayload, historyPayload, positions] = await Promise.all([
        krakenCliService.paperStatus(mode),
        krakenCliService.paperBalance(mode),
        krakenCliService.paperHistory(mode),
        prisma.position.findMany({ where: { workspaceId }, orderBy: { openedAt: "desc" } })
      ]);

      let openUnrealized = 0;
      for (const position of positions) {
        const positionMode = inferPositionAccountMode(position);
        const ticker = await krakenCliService.ticker(position.symbol);
        const currentPrice = krakenCliService.extractTickerPrice(ticker, position.symbol) ?? position.currentPrice;
        const unrealizedPnL = round((currentPrice - position.entryPrice) * position.size * directionMultiplier(position.side), 2);
        const unrealizedPnLPercent = position.collateral === 0 ? 0 : round((unrealizedPnL / position.collateral) * 100, 2);
        const liquidationPrice = calculateLiquidationPrice(position.entryPrice, position.side, Math.max(position.leverage, 1), positionMode);
        openUnrealized += unrealizedPnL;

        await prisma.position.update({
          where: { id: position.id },
          data: {
            currentPrice,
            unrealizedPnL,
            unrealizedPnLPercent,
            liquidationPrice
          }
        });
      }

      const normalizedStatus = krakenCliService.normalizePaperStatus(statusPayload);
      const normalizedBalance = krakenCliService.normalizePaperStatus(balancePayload);
      const recentOrders = krakenCliService.normalizePaperHistory(historyPayload).slice(0, 8);
      const syncedAt = new Date().toISOString();
      const balance = normalizedBalance.balance > 0
        ? round(normalizedBalance.balance, 2)
        : normalizedStatus.balance > 0
          ? round(normalizedStatus.balance, 2)
          : snapshot.paper.balance;
      const equity = positions.length === 0
        ? round(balance, 2)
        : normalizedStatus.equity > 0
          ? round(normalizedStatus.equity, 2)
          : round(balance + openUnrealized, 2);

      snapshot.paper = {
        ...snapshot.paper,
        status: "healthy",
        accountMode: mode,
        leverage,
        source: normalizedStatus.source,
        initialized: normalizedStatus.initialized || snapshot.paper.initialized,
        syncedAt,
        equity,
        balance,
        unrealizedPnL: round(openUnrealized, 2),
        realizedPnL: round(normalizedStatus.realizedPnl, 2),
        tradeCount: Math.max(normalizedStatus.tradeCount, recentOrders.length, snapshot.trades.length),
        openPositionCount: positions.length,
        lastError: null,
        recentOrders
      };

      setMetricValue(snapshot, "Total Equity", snapshot.paper.equity, `Paper Trading ${accountModeLabel(mode)}`);
      setMetricValue(snapshot, "Available Balance", snapshot.paper.balance, `${accountModeLabel(mode)} paper cash`);
      snapshot.system.connections.lastSyncLabel = formatSyncLabel(new Date(syncedAt));

      if (options.persist) {
        await this.persistSnapshot(workspaceId, snapshot);
      }

      return { snapshot, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown paper sync failure.";
      snapshot.paper = {
        ...snapshot.paper,
        status: "error",
        lastError: message
      };
      snapshot.system.connections.lastSyncLabel = formatSyncLabel(snapshot.paper.syncedAt ? new Date(snapshot.paper.syncedAt) : null);

      if (options.logErrors) {
        await this.appendLog(workspaceId, "error", "error", "Paper account sync failed.", { error: message });
      }
      if (options.persist) {
        await this.persistSnapshot(workspaceId, snapshot);
      }

      return { snapshot, error: message };
    }
  }

  syncPaperAccount = async () => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(false);

    if (!snapshot.settings.exchange.paperTrading) {
      return { ok: false, message: "Paper trading is not enabled.", snapshot };
    }

    const result = await this.reconcilePaperState(workspaceId, snapshot, { persist: true, logErrors: true });
    const nextSnapshot = await this.getSnapshot(false);
    return {
      ok: !result.error,
      message: result.error ? `Paper sync failed: ${result.error}` : "Paper account synced.",
      snapshot: nextSnapshot
    };
  };

  setStrategyRunnerEnabled = async (enabled: boolean, cadenceSeconds?: number) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(false);
    this.ensureRunnerState(snapshot);
    snapshot.strategy.runner.enabled = enabled;
    snapshot.strategy.runner.status = enabled ? "Running" : "Stopped";
    snapshot.strategy.runner.cadenceSeconds = cadenceSeconds != null ? Math.max(Math.round(cadenceSeconds), 10) : snapshot.strategy.runner.cadenceSeconds;
    snapshot.strategy.runner.latestSummary = enabled
      ? `Strategy runner active on a ${snapshot.strategy.runner.cadenceSeconds}s cadence.`
      : "Strategy runner stopped.";
    snapshot.strategy.readiness = snapshot.strategy.paused ? "Paused" : enabled ? "Auto Running" : "Ready";

    await this.appendLog(workspaceId, "execution", "info", enabled ? "Strategy runner started." : "Strategy runner stopped.", {
      cadenceSeconds: snapshot.strategy.runner.cadenceSeconds,
      enabled
    });

    return this.persistAndHydrate(workspaceId, snapshot);
  };

  markStrategyRunnerError = async (message: string) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(false);
    this.ensureRunnerState(snapshot);
    snapshot.strategy.runner.status = "Error";
    snapshot.strategy.runner.latestSummary = message;
    await this.appendLog(workspaceId, "error", "error", "Strategy runner failed.", { error: message });
    return this.persistAndHydrate(workspaceId, snapshot);
  };

  runStrategyCycle = async (trigger: "manual" | "interval" | "bootstrap" = "manual") => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(true);
    this.ensureRunnerState(snapshot);

    const now = new Date().toISOString();
    snapshot.strategy.selectedStrategy = "AI Regime & Execution Strategist";
    snapshot.strategy.runner.lastRunAt = now;
    snapshot.strategy.runner.status = snapshot.strategy.runner.enabled ? "Running" : "Stopped";

    if (!snapshot.settings.exchange.connected || !snapshot.settings.exchange.paperTrading) {
      snapshot.strategy.runner.latestSummary = "Runner skipped because paper trading is not enabled.";
      await this.recordJob(workspaceId, "strategy.runner.cycle", "Completed", 100, { trigger, skipped: true, reason: "paper_trading_disabled" });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: snapshot.strategy.runner.latestSummary, snapshot: nextSnapshot };
    }

    if (snapshot.strategy.paused) {
      snapshot.strategy.runner.latestSummary = "Runner skipped because the strategy is paused.";
      await this.recordJob(workspaceId, "strategy.runner.cycle", "Completed", 100, { trigger, skipped: true, reason: "strategy_paused" });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: snapshot.strategy.runner.latestSummary, snapshot: nextSnapshot };
    }

    const watchedSymbols = Array.from(new Set((snapshot.strategy.runner.watchedSymbols.length > 0
      ? snapshot.strategy.runner.watchedSymbols
      : snapshot.risk.policy.whitelistedMarkets).filter((symbol): symbol is string => Boolean(symbol)))) as string[];

    snapshot.strategy.runner.watchedSymbols = watchedSymbols;

    const accountMode = snapshot.settings.exchange.accountMode ?? "spot";
    const confidenceThreshold = snapshot.strategy.runner.confidenceThreshold;
    const attributionByMode = {
      spot: buildModeAttribution("spot", snapshot.trades, snapshot.positions),
      futures: buildModeAttribution("futures", snapshot.trades, snapshot.positions)
    };
    const futuresThrottle = buildFuturesThrottle(snapshot, attributionByMode.futures);
    const futuresDefense = buildFuturesDefensePlan(snapshot, futuresThrottle);
    const positionExitPlan = buildPositionExitPlan(snapshot);
    const portfolioContext = buildPortfolioContext(snapshot, accountMode, attributionByMode);

    snapshot.strategy.ai = {
      ...snapshot.strategy.ai,
      futuresThrottle,
      futuresDefense,
      positionExitEngine: positionExitPlan,
      portfolioAllocation: {
        active: snapshot.positions.some((position) => position.accountMode === accountMode),
        status: snapshot.positions.some((position) => position.accountMode === accountMode) ? "Sizing" : "Idle",
        mode: accountMode,
        targetSymbol: null,
        targetAccountMode: null,
        targetBucket: null,
        targetSide: null,
        summary: portfolioContext.summary,
        reasons: portfolioContext.reasons,
        recommendedSizeMultiplier: 1,
        effectiveTradeSizeUsd: round(snapshot.strategy.runner.tradeSizeUsd, 2),
        leverageCap: accountMode === "futures" ? futuresThrottle.leverageCap : 1,
        modeExposureUtilization: portfolioContext.modeExposureUtilization,
        bucketExposureUtilization: 0,
        sideExposureUtilization: 0,
        portfolioHeat: portfolioContext.portfolioHeat,
        openPositionsInMode: portfolioContext.openPositionsInMode,
        openPositionsInBucket: 0,
        appliedAt: null
      }
    };

    if (positionExitPlan.targets.length > 0) {
      const exitOutcomes: Array<{ target: PositionExitTarget; realizedPnL: number; currentPrice: number }> = [];

      for (const target of positionExitPlan.targets) {
        const livePosition = await prisma.position.findUnique({ where: { id: target.positionId } });
        if (!livePosition || livePosition.workspaceId !== workspaceId) {
          continue;
        }

        const liveMode = inferPositionAccountMode(livePosition);
        const liveLeverage = accountLeverage(liveMode, Math.max(livePosition.leverage ?? 1, 1));
        const exitResult = await this.applyPositionAdjustment(workspaceId, snapshot, livePosition as typeof livePosition & { workspaceId: string }, {
          action: "close",
          signalSummary: target.trigger === "stop_loss"
            ? "Automated stop-loss close from strategy exit engine"
            : "Automated take-profit close from strategy exit engine",
          riskSummary: target.trigger === "stop_loss"
            ? `Bounded exit engine closed ${livePosition.symbol} after stop-loss trigger on ${accountModeLabel(liveMode).toLowerCase()} exposure`
            : `Bounded exit engine closed ${livePosition.symbol} after take-profit trigger on ${accountModeLabel(liveMode).toLowerCase()} exposure`,
          strategyLabel: `${snapshot.strategy.selectedStrategy} / Auto Exit / ${accountModeLabel(liveMode)}${liveMode === "futures" ? ` ${liveLeverage}x` : ""}`,
          jobType: target.trigger === "stop_loss"
            ? `kraken.${liveMode}.paper.exit.stop`
            : `kraken.${liveMode}.paper.exit.take_profit`,
          logStream: "execution",
          logLevel: target.trigger === "stop_loss" ? "warning" : "success",
          logMessage: target.trigger === "stop_loss"
            ? `Auto exit engine closed ${livePosition.symbol} on stop-loss.`
            : `Auto exit engine closed ${livePosition.symbol} on take-profit.`,
          successMessage: target.trigger === "stop_loss"
            ? `Auto exit closed ${livePosition.symbol} on stop-loss.`
            : `Auto exit closed ${livePosition.symbol} on take-profit.`,
          meta: {
            trigger,
            exitEngineTrigger: target.trigger,
            accountMode: liveMode,
            leverage: liveLeverage
          }
        });

        exitOutcomes.push({
          target,
          realizedPnL: exitResult.realizedPnL,
          currentPrice: exitResult.currentPrice
        });

        snapshot.strategy.eventHistory = [
          {
            id: generateId("EVT"),
            type: target.trigger === "stop_loss" ? "Auto Stop Exit" : "Auto Take-Profit Exit",
            symbol: livePosition.symbol,
            action: livePosition.side,
            confidence: null,
            outcome: target.trigger === "stop_loss"
              ? `Closed at stop-loss via ${accountModeLabel(liveMode)}`
              : `Closed at take-profit via ${accountModeLabel(liveMode)}`,
            timestamp: now
          },
          ...snapshot.strategy.eventHistory
        ].slice(0, 12);
      }

      const stopCount = exitOutcomes.filter((item) => item.target.trigger === "stop_loss").length;
      const takeCount = exitOutcomes.filter((item) => item.target.trigger === "take_profit").length;
      const realizedTotal = round(exitOutcomes.reduce((sum, item) => sum + item.realizedPnL, 0), 2);
      const firstOutcome = exitOutcomes[0] ?? null;
      const latestSummary = exitOutcomes.length === 0
        ? "Exit engine found stale targets but no live positions to close."
        : `Auto exit engine closed ${exitOutcomes.length} position${exitOutcomes.length === 1 ? "" : "s"} before new entries. ${stopCount > 0 ? `${stopCount} stop-loss` : ""}${stopCount > 0 && takeCount > 0 ? " and " : ""}${takeCount > 0 ? `${takeCount} take-profit` : ""} trigger${exitOutcomes.length === 1 ? "" : "s"}.`.replace("  ", " ");

      snapshot.strategy.runner.latestSummary = latestSummary;
      snapshot.strategy.readiness = "Exit Managed";
      snapshot.strategy.marketConditions = {
        ...snapshot.strategy.marketConditions,
        "Runner Trigger": trigger,
        "Account Mode": accountModeLabel(accountMode),
        "Auto Exit Engine": exitOutcomes.length === 0 ? "Monitoring" : `${exitOutcomes.length} closed`,
        "Auto Exit Detail": stopCount > 0 && takeCount > 0
          ? `${stopCount} stop-loss · ${takeCount} take-profit`
          : stopCount > 0
            ? `${stopCount} stop-loss`
            : takeCount > 0
              ? `${takeCount} take-profit`
              : "Monitoring",
        "Futures Throttle": futuresThrottle.posture,
        "Futures Defense": futuresDefense.action === "HOLD" ? futuresDefense.status : `${futuresDefense.status} ${futuresDefense.targetSymbol ?? ""}`.trim()
      };
      snapshot.strategy.ai.positionExitEngine = {
        ...positionExitPlan,
        status: exitOutcomes.length > 0 ? "Exited" : positionExitPlan.status,
        appliedAt: exitOutcomes.length > 0 ? now : null,
        lastExitPrice: firstOutcome?.currentPrice ?? null,
        lastRealizedPnL: exitOutcomes.length > 0 ? realizedTotal : null,
        summary: latestSummary,
        stopTriggeredCount: stopCount,
        takeProfitTriggeredCount: takeCount
      };
      snapshot.strategy.aiCommentary = [
        {
          label: "Position Exit Engine",
          tone: stopCount > 0 ? "cautious" : takeCount > 0 ? "positive" : "neutral",
          timestamp: now,
          body: latestSummary
        },
        ...snapshot.strategy.aiCommentary.filter((item) => item.label !== "Position Exit Engine")
      ].slice(0, 5);

      await this.recordJob(workspaceId, "strategy.runner.cycle", "Completed", 100, {
        trigger,
        exitEngine: {
          action: positionExitPlan.action,
          closedCount: exitOutcomes.length,
          stopTriggeredCount: stopCount,
          takeProfitTriggeredCount: takeCount,
          realizedPnL: realizedTotal,
          targets: exitOutcomes.map((item) => ({
            positionId: item.target.positionId,
            symbol: item.target.symbol,
            accountMode: item.target.accountMode,
            trigger: item.target.trigger,
            exitPrice: item.currentPrice,
            realizedPnL: item.realizedPnL
          }))
        },
      futuresThrottle: {
          posture: futuresThrottle.posture,
          score: futuresThrottle.score,
          blockNewEntries: futuresThrottle.blockNewEntries
        },
        futuresDefense: {
          status: futuresDefense.status,
          action: futuresDefense.action,
          targetSymbol: futuresDefense.targetSymbol
        }
      });
      await this.appendLog(workspaceId, stopCount > 0 ? "risk" : "execution", stopCount > 0 ? "warning" : "success", "Position exit engine completed a cycle before new entries.", {
        trigger,
        closedCount: exitOutcomes.length,
        stopTriggeredCount: stopCount,
        takeProfitTriggeredCount: takeCount,
        realizedPnL: realizedTotal,
        accountMode,
        targets: exitOutcomes.map((item) => ({
          symbol: item.target.symbol,
          accountMode: item.target.accountMode,
          trigger: item.target.trigger,
          exitPrice: item.currentPrice,
          realizedPnL: item.realizedPnL
        }))
      });

      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return {
        ok: exitOutcomes.length > 0,
        message: latestSummary,
        snapshot: nextSnapshot
      };
    }

    const candidates: StrategyCandidate[] = [];
    const marketContextBySymbol = new Map<string, MarketContext>();
    const marketContextByCandidateId = new Map<string, MarketContext>();

    for (const symbol of watchedSymbols) {
      const ticker = await krakenCliService.ticker(symbol);
      const price = krakenCliService.extractTickerPrice(ticker, symbol);
      if (!price) {
        continue;
      }

      const history = this.rememberPrice(symbol, price);
      let analysis = this.buildStrategyCandidates(symbol, history);
      let marketContext: MarketContext | null = null;

      try {
        const [ohlc5Payload, ohlc15Payload, ohlc1hPayload, depthPayload] = await Promise.all([
          krakenCliService.ohlc(symbol, 5),
          krakenCliService.ohlc(symbol, 15),
          krakenCliService.ohlc(symbol, 60),
          krakenCliService.depth(symbol, 10)
        ]);
        const candles5m = krakenCliService.extractOhlcRows(ohlc5Payload);
        const candles15m = krakenCliService.extractOhlcRows(ohlc15Payload);
        const candles1h = krakenCliService.extractOhlcRows(ohlc1hPayload);
        const depthMetrics = krakenCliService.extractDepthMetrics(depthPayload);

        if (candles5m.length >= 10 && candles15m.length >= 10 && candles1h.length >= 10) {
          marketContext = this.buildMarketContext(symbol, price, candles5m, candles15m, candles1h, depthMetrics);
          analysis = this.buildExecutionAwareCandidates(symbol, marketContext);
          marketContextBySymbol.set(symbol, marketContext);
        }
      } catch (error) {
        await this.appendLog(workspaceId, "signal", "warning", `Market context fallback activated for ${symbol}.`, {
          trigger,
          symbol,
          error: error instanceof Error ? error.message : "Unknown market context error."
        });
      }

      const leadCandidate = analysis.candidates[0] ?? null;

      snapshot.dashboard.recentSignals = [
        {
          id: generateId("SIG"),
          symbol,
          type: analysis.observation.type,
          confidence: analysis.observation.confidence,
          action: analysis.observation.action,
          time: now
        },
        ...snapshot.dashboard.recentSignals
      ].slice(0, 8);

      snapshot.strategy.eventHistory = [
        {
          id: generateId("EVT"),
          type: leadCandidate ? `${leadCandidate.module} Candidate` : analysis.observation.type,
          symbol,
          action: leadCandidate?.action ?? analysis.observation.action,
          confidence: leadCandidate?.confidence ?? analysis.observation.confidence,
          outcome: leadCandidate ? `${analysis.candidates.length} candidate${analysis.candidates.length === 1 ? "" : "s"} ranked` : analysis.observation.summary,
          timestamp: now
        },
        ...snapshot.strategy.eventHistory
      ].slice(0, 12);

      await this.appendLog(workspaceId, "signal", "info", `AI feature engine evaluated ${symbol}.`, {
        trigger,
        price,
        regime: analysis.observation.regime,
        candidateCount: analysis.candidates.length,
        leadCandidate: leadCandidate ? {
          id: leadCandidate.id,
          module: leadCandidate.module,
          action: leadCandidate.action,
          confidence: leadCandidate.confidence,
          stopLossPercent: leadCandidate.stopLossPercent,
          takeProfitPercent: leadCandidate.takeProfitPercent,
          sizeMultiplier: leadCandidate.sizeMultiplier,
          atrPercent: leadCandidate.atrPercent,
          spreadBps: leadCandidate.spreadBps,
          executionQuality: leadCandidate.executionQuality
        } : null,
        marketContext: marketContext ? {
          regime: marketContext.regime,
          trend1hPercent: marketContext.trend1hPercent,
          trend15mPercent: marketContext.trend15mPercent,
          atr15mPercent: marketContext.atr15mPercent,
          spreadBps: marketContext.spreadBps,
          bookImbalance: marketContext.bookImbalance,
          liquidityUsd: marketContext.liquidityUsd,
          executionQuality: marketContext.executionQuality
        } : null,
        observation: analysis.observation
      });

      candidates.push(...analysis.candidates);
      if (marketContext) {
        for (const candidate of analysis.candidates) {
          marketContextByCandidateId.set(candidate.id, marketContext);
        }
      }
    }

    const rankedCandidates = [...candidates].sort((left, right) => right.confidence - left.confidence);
    const effectiveConfidenceThreshold = accountMode === "futures" ? futuresThrottle.adjustedConfidenceThreshold : confidenceThreshold;
    const effectiveMaxTradesPerDay = accountMode === "futures" ? futuresThrottle.adjustedMaxTradesPerDay : snapshot.strategy.runner.maxTradesPerDay;
    const todaysExecutedTrades = snapshot.trades.filter((trade) => sameDay(new Date(trade.openedAt)) && trade.signalSummary.includes("Trigger=")).length;
    const todaysExecutedTradesByMode = snapshot.trades.filter((trade) => sameDay(new Date(trade.openedAt)) && trade.signalSummary.includes("Trigger=") && trade.accountMode === accountMode).length;
    const closedTradesDesc = [...snapshot.trades]
      .filter((trade) => trade.status === "Closed")
      .sort((left, right) => new Date(right.closedAt ?? right.openedAt).getTime() - new Date(left.closedAt ?? left.openedAt).getTime());
    const consecutiveLosses = consecutiveLossStreak(snapshot.trades);
    const consecutiveLossesByMode = consecutiveLossStreak(snapshot.trades, accountMode);
    const recentClosedTradesSource = accountMode === "futures"
      ? closedTradesDesc.filter((trade) => trade.accountMode === "futures")
      : closedTradesDesc;
    const recentClosedTrades = recentClosedTradesSource.slice(0, 12);
    const recentWins = recentClosedTrades.filter((trade) => trade.realizedPnL > 0).length;
    const recentWinRate = recentClosedTrades.length === 0 ? 0 : round((recentWins / recentClosedTrades.length) * 100, 1);
    const currentDrawdownPercent = Math.abs(Math.min(snapshot.dashboard.maxDrawdown, 0));
    const aiCandidates = rankedCandidates.map((candidate) => {
      const bucket = correlatedBucket(candidate.symbol);
      const bucketPositions = snapshot.positions.filter((position) => position.accountMode === accountMode && correlatedBucket(position.symbol) === bucket);
      return {
        ...candidate,
        bucket,
        bucketOpenPositions: bucketPositions.length,
        bucketOpenNotionalUsd: round(bucketPositions.reduce((sum, position) => sum + positionOpenNotionalUsd(position), 0), 2),
        sameSideBucketExposure: bucketPositions.some((position) => position.side === candidate.action)
      };
    });
    const heuristicsTopCandidate = aiCandidates.find((candidate) => candidate.confidence >= effectiveConfidenceThreshold) ?? null;

    const aiDecision = await aiDecisionService.analyze({
      trigger,
      strategyName: snapshot.strategy.selectedStrategy,
      accountMode,
      watchedSymbols,
      confidenceThreshold,
      effectiveConfidenceThreshold,
      effectiveMaxTradesPerDay,
      candidates: aiCandidates,
      heuristicsTopCandidate,
      paperBalance: snapshot.paper.balance,
      openPositionCount: snapshot.positions.length,
      consecutiveLosses: accountMode === "futures" ? Math.max(consecutiveLosses, consecutiveLossesByMode) : consecutiveLosses,
      todaysExecutedTrades: todaysExecutedTradesByMode,
      maxTradesPerDay: snapshot.strategy.runner.maxTradesPerDay,
      recentWinRate,
      currentDrawdownPercent,
      modeAttribution: {
        spot: {
          realizedToday: attributionByMode.spot.realizedToday,
          realizedWeek: attributionByMode.spot.realizedWeek,
          realizedTotal: attributionByMode.spot.realizedTotal,
          openUnrealized: attributionByMode.spot.openUnrealized,
          openNotionalUsd: attributionByMode.spot.openNotionalUsd,
          maxDrawdown: attributionByMode.spot.maxDrawdown,
          winRate: attributionByMode.spot.winRate,
          openPositions: attributionByMode.spot.openPositions,
          averageLeverage: attributionByMode.spot.averageLeverage,
          closedTrades: attributionByMode.spot.closedTrades
        },
        futures: {
          realizedToday: attributionByMode.futures.realizedToday,
          realizedWeek: attributionByMode.futures.realizedWeek,
          realizedTotal: attributionByMode.futures.realizedTotal,
          openUnrealized: attributionByMode.futures.openUnrealized,
          openNotionalUsd: attributionByMode.futures.openNotionalUsd,
          maxDrawdown: attributionByMode.futures.maxDrawdown,
          winRate: attributionByMode.futures.winRate,
          openPositions: attributionByMode.futures.openPositions,
          averageLeverage: attributionByMode.futures.averageLeverage,
          closedTrades: attributionByMode.futures.closedTrades
        }
      },
      portfolioContext: {
        modeExposureUtilization: portfolioContext.modeExposureUtilization,
        portfolioHeat: portfolioContext.portfolioHeat,
        openPositionsInMode: portfolioContext.openPositionsInMode,
        dominantSide: portfolioContext.dominantSide,
        crowdedBuckets: portfolioContext.crowdedBuckets,
        summary: portfolioContext.summary
      },
      futuresThrottle: {
        active: futuresThrottle.active,
        posture: futuresThrottle.posture,
        score: futuresThrottle.score,
        blockNewEntries: futuresThrottle.blockNewEntries,
        adjustedConfidenceThreshold: futuresThrottle.adjustedConfidenceThreshold,
        adjustedMaxTradesPerDay: futuresThrottle.adjustedMaxTradesPerDay,
        adjustedTradeSizeUsd: futuresThrottle.adjustedTradeSizeUsd,
        leverageCap: futuresThrottle.leverageCap,
        sizeFactor: futuresThrottle.sizeFactor,
        summary: futuresThrottle.summary,
        reasons: futuresThrottle.reasons,
        dailyLossUtilization: futuresThrottle.dailyLossUtilization,
        drawdownUtilization: futuresThrottle.drawdownUtilization,
        exposureUtilization: futuresThrottle.exposureUtilization,
        minLiquidationBufferPercent: futuresThrottle.minLiquidationBufferPercent,
        lossStreak: futuresThrottle.lossStreak,
        winRate: futuresThrottle.winRate
      }
    });

    let topCandidate = aiDecision.shouldTrade && aiDecision.selectedCandidateId
      ? rankedCandidates.find((candidate) => candidate.id === aiDecision.selectedCandidateId) ?? null
      : null;

    if (topCandidate && topCandidate.confidence < effectiveConfidenceThreshold) {
      topCandidate = null;
    }

    if (accountMode === "futures" && futuresThrottle.blockNewEntries) {
      topCandidate = null;
    }

    const allocationPlan = topCandidate
      ? buildPortfolioAllocationPlan(snapshot, { symbol: topCandidate.symbol, side: topCandidate.action, accountMode }, attributionByMode)
      : null;

    if (allocationPlan) {
      snapshot.strategy.ai.portfolioAllocation = allocationPlan;
    }

    const topContext = topCandidate
      ? marketContextByCandidateId.get(topCandidate.id) ?? marketContextBySymbol.get(topCandidate.symbol) ?? null
      : null;

    snapshot.strategy.marketRegime = aiDecision.regime;
    snapshot.strategy.currentMode = aiDecision.strategyModule ?? aiDecision.mode;
    snapshot.strategy.runner.lastSignalAt = rankedCandidates.length > 0 ? now : snapshot.strategy.runner.lastSignalAt;
    snapshot.strategy.ai = {
      enabled: aiDecision.enabled,
      provider: aiDecision.provider,
      model: aiDecision.model,
      status: aiDecision.status,
      lastDecisionAt: aiDecision.lastDecisionAt,
      recommendedAction: aiDecision.recommendedAction,
      recommendedSymbol: aiDecision.recommendedSymbol,
      confidence: aiDecision.confidence,
      rationale: aiDecision.rationale,
      riskNote: aiDecision.riskNote,
      error: aiDecision.error,
      selectedCandidateId: aiDecision.selectedCandidateId,
      strategyModule: aiDecision.strategyModule,
      executionBias: aiDecision.executionBias,
      sizeMultiplier: aiDecision.sizeMultiplier,
      stopLossPercent: aiDecision.stopLossPercent,
      takeProfitPercent: aiDecision.takeProfitPercent,
      rankingSummary: aiDecision.rankingSummary,
      futuresThrottle,
      futuresDefense,
      positionExitEngine: positionExitPlan,
      portfolioAllocation: allocationPlan ?? {
        active: snapshot.positions.some((position) => position.accountMode === accountMode),
        status: snapshot.positions.some((position) => position.accountMode === accountMode) ? "Sizing" : "Idle",
        mode: accountMode,
        targetSymbol: null,
        targetAccountMode: null,
        targetBucket: null,
        targetSide: null,
        summary: portfolioContext.summary,
        reasons: portfolioContext.reasons,
        recommendedSizeMultiplier: 1,
        effectiveTradeSizeUsd: round(snapshot.strategy.runner.tradeSizeUsd, 2),
        leverageCap: accountMode === "futures" ? futuresThrottle.leverageCap : 1,
        modeExposureUtilization: portfolioContext.modeExposureUtilization,
        bucketExposureUtilization: 0,
        sideExposureUtilization: 0,
        portfolioHeat: portfolioContext.portfolioHeat,
        openPositionsInMode: portfolioContext.openPositionsInMode,
        openPositionsInBucket: 0,
        appliedAt: null
      }
    };
    snapshot.strategy.aiCommentary = [
      {
        label: "AI Strategy Brain",
        tone: topCandidate ? "confident" : aiDecision.status === "Error" ? "cautious" : "neutral",
        timestamp: now,
        body: aiDecision.commentary
      },
      {
        label: "AI Ranking Summary",
        tone: topCandidate ? "positive" : "neutral",
        timestamp: now,
        body: aiDecision.rankingSummary ?? "No ranking summary returned."
      },
      {
        label: "Execution Context",
        tone: topContext && topContext.executionQuality >= 0.55 ? "positive" : "neutral",
        timestamp: now,
        body: topContext
          ? `1h trend ${topContext.trend1hPercent.toFixed(2)}%, 15m trend ${topContext.trend15mPercent.toFixed(2)}%, 15m ATR ${topContext.atr15mPercent.toFixed(2)}%, spread ${topContext.spreadBps.toFixed(1)} bps, depth $${topContext.liquidityUsd.toFixed(0)}, execution quality ${(topContext.executionQuality * 100).toFixed(0)}%.`
          : "No execution context available for the top-ranked symbol yet."
      },
      {
        label: "AI Risk View",
        tone: aiDecision.status === "Error" ? "cautious" : topCandidate ? "positive" : "neutral",
        timestamp: now,
        body: `${aiDecision.rationale} ${aiDecision.riskNote}`
      },
      {
        label: "Futures Throttle",
        tone: futuresThrottle.posture === "Normal" ? "neutral" : futuresThrottle.posture === "Guarded" ? "positive" : "cautious",
        timestamp: now,
        body: `${futuresThrottle.summary}${futuresThrottle.reasons.length > 0 ? ` ${futuresThrottle.reasons.slice(0, 2).join(" ")}` : ""}`
      },
      {
        label: "Futures Defense",
        tone: futuresDefense.action === "CLOSE" ? "cautious" : futuresDefense.action === "HOLD" ? "neutral" : "positive",
        timestamp: now,
        body: `${futuresDefense.summary}${futuresDefense.reasons.length > 0 ? ` ${futuresDefense.reasons.slice(0, 2).join(" ")}` : ""}`
      },
      {
        label: "Position Exit Engine",
        tone: positionExitPlan.action === "STOP_LOSS_CLOSE" || positionExitPlan.action === "MIXED_CLOSE" ? "cautious" : positionExitPlan.action === "TAKE_PROFIT_CLOSE" ? "positive" : "neutral",
        timestamp: now,
        body: `${positionExitPlan.summary}${positionExitPlan.reasons.length > 0 ? ` ${positionExitPlan.reasons.slice(0, 2).join(" ")}` : ""}`
      },
      {
        label: "Portfolio Allocation",
        tone: (allocationPlan?.status ?? "Idle") === "Blocked" ? "cautious" : (allocationPlan?.status ?? "Idle") === "Constrained" ? "neutral" : "positive",
        timestamp: now,
        body: `${(allocationPlan?.summary ?? portfolioContext.summary)}${(allocationPlan?.reasons.length ?? 0) > 0 ? ` ${(allocationPlan?.reasons ?? []).slice(0, 2).join(" ")}` : ""}`
      },
      ...snapshot.strategy.aiCommentary.filter((item) => !["AI Strategy Brain", "AI Ranking Summary", "Execution Context", "AI Risk View", "Futures Throttle", "Futures Defense", "Position Exit Engine", "Portfolio Allocation"].includes(item.label))
    ].slice(0, 5);

    snapshot.strategy.runner.latestSummary = topCandidate
      ? `${accountMode === "futures" && futuresThrottle.posture !== "Normal" ? `[${futuresThrottle.posture}] ` : ""}AI selected ${topCandidate.symbol} ${topCandidate.action} via ${aiDecision.strategyModule ?? topCandidate.module} at ${Math.round((aiDecision.confidence ?? topCandidate.confidence) * 100)}% confidence.`
      : aiDecision.commentary;

    snapshot.strategy.marketConditions = {
      ...snapshot.strategy.marketConditions,
      "Runner Trigger": trigger,
      "Account Mode": accountModeLabel(accountMode),
      "Watched Symbols": watchedSymbols.join(", "),
      "Last Runner Scan": now,
      "Candidate Count": String(rankedCandidates.length),
      "Base Confidence Threshold": `${(confidenceThreshold * 100).toFixed(0)}%`,
      "Effective Confidence Threshold": `${(effectiveConfidenceThreshold * 100).toFixed(0)}%`,
      "Trades Used Today": `${todaysExecutedTradesByMode}/${effectiveMaxTradesPerDay}`,
      "Global Trades Today": `${todaysExecutedTrades}/${snapshot.strategy.runner.maxTradesPerDay}`,
      "Consecutive Losses": String(accountMode === "futures" ? Math.max(consecutiveLosses, consecutiveLossesByMode) : consecutiveLosses),
      "Recent Win Rate": `${recentWinRate.toFixed(1)}%`,
      "Current Drawdown": `${currentDrawdownPercent.toFixed(2)}%`,
      "AI Provider": aiDecision.provider === "llm" ? "Live model" : "Heuristic fallback",
      "AI Model": aiDecision.model,
      "AI Module": aiDecision.strategyModule ?? "Observation",
      "Execution Bias": aiDecision.executionBias ?? "Balanced",
      "AI Recommendation": topCandidate ? `${topCandidate.symbol} ${topCandidate.action}` : "HOLD",
      "Futures Throttle": futuresThrottle.posture,
      "Futures Defense": futuresDefense.action === "HOLD" ? futuresDefense.status : `${futuresDefense.status} ${futuresDefense.targetSymbol ?? ""}`.trim(),
      "Auto Exit Engine": positionExitPlan.action === "HOLD"
        ? positionExitPlan.status
        : `${positionExitPlan.status} ${positionExitPlan.targetSymbol ?? ""}`.trim(),
      "Futures Leverage Cap": `${futuresThrottle.leverageCap}x`,
      "Futures Size Factor": `${Math.round(futuresThrottle.sizeFactor * 100)}%`,
      "Futures Open Exposure": `$${attributionByMode.futures.openNotionalUsd.toFixed(2)}`,
      "1h Trend": topContext ? `${topContext.trend1hPercent.toFixed(2)}%` : "—",
      "15m Trend": topContext ? `${topContext.trend15mPercent.toFixed(2)}%` : "—",
      "5m Momentum": topContext ? `${topContext.momentum5mPercent.toFixed(2)}%` : "—",
      "15m ATR": topContext ? `${topContext.atr15mPercent.toFixed(2)}%` : "—",
      "Spread": topContext ? `${topContext.spreadBps.toFixed(1)} bps` : "—",
      "Book Imbalance": topContext ? topContext.bookImbalance.toFixed(2) : "—",
      "Order Book Depth": topContext ? `$${topContext.liquidityUsd.toFixed(0)}` : "—",
      "Execution Quality": topContext ? `${(topContext.executionQuality * 100).toFixed(0)}%` : "—"
    };

    await this.recordJob(workspaceId, "strategy.runner.cycle", "Completed", 100, {
      trigger,
      watchedSymbols,
      candidateCount: rankedCandidates.length,
      topCandidate: topCandidate ? {
        id: topCandidate.id,
        symbol: topCandidate.symbol,
        action: topCandidate.action,
        confidence: topCandidate.confidence,
        module: topCandidate.module,
        atrPercent: topCandidate.atrPercent,
        spreadBps: topCandidate.spreadBps,
        executionQuality: topCandidate.executionQuality
      } : null,
      ai: {
        provider: aiDecision.provider,
        model: aiDecision.model,
        status: aiDecision.status,
        recommendedSymbol: aiDecision.recommendedSymbol,
        recommendedAction: aiDecision.recommendedAction,
        confidence: aiDecision.confidence,
        selectedCandidateId: aiDecision.selectedCandidateId,
        strategyModule: aiDecision.strategyModule,
        executionBias: aiDecision.executionBias,
        sizeMultiplier: aiDecision.sizeMultiplier,
        stopLossPercent: aiDecision.stopLossPercent,
        takeProfitPercent: aiDecision.takeProfitPercent,
        effectiveConfidenceThreshold,
        effectiveMaxTradesPerDay
      },
      futuresThrottle: {
        posture: futuresThrottle.posture,
        score: futuresThrottle.score,
        blockNewEntries: futuresThrottle.blockNewEntries,
        leverageCap: futuresThrottle.leverageCap,
        sizeFactor: futuresThrottle.sizeFactor,
        adjustedConfidenceThreshold: futuresThrottle.adjustedConfidenceThreshold,
        adjustedMaxTradesPerDay: futuresThrottle.adjustedMaxTradesPerDay,
        reasons: futuresThrottle.reasons
      },
      futuresDefense: {
        status: futuresDefense.status,
        action: futuresDefense.action,
        targetSymbol: futuresDefense.targetSymbol,
        score: futuresDefense.score,
        reasons: futuresDefense.reasons
      },
      positionExitEngine: {
        status: positionExitPlan.status,
        action: positionExitPlan.action,
        targetSymbol: positionExitPlan.targetSymbol,
        targetAccountMode: positionExitPlan.targetAccountMode,
        stopTriggeredCount: positionExitPlan.stopTriggeredCount,
        takeProfitTriggeredCount: positionExitPlan.takeProfitTriggeredCount,
        reasons: positionExitPlan.reasons
      }
    });

    await this.appendLog(workspaceId, "signal", aiDecision.status === "Error" ? "warning" : "info", "AI strategy brain completed a runner review.", {
      provider: aiDecision.provider,
      model: aiDecision.model,
      status: aiDecision.status,
      selectedCandidateId: aiDecision.selectedCandidateId,
      recommendedSymbol: aiDecision.recommendedSymbol,
      recommendedAction: aiDecision.recommendedAction,
      confidence: aiDecision.confidence,
      strategyModule: aiDecision.strategyModule,
      executionBias: aiDecision.executionBias,
      rankingSummary: aiDecision.rankingSummary,
      futuresThrottle: {
        posture: futuresThrottle.posture,
        summary: futuresThrottle.summary,
        blockNewEntries: futuresThrottle.blockNewEntries,
        leverageCap: futuresThrottle.leverageCap,
        sizeFactor: futuresThrottle.sizeFactor,
        adjustedConfidenceThreshold: futuresThrottle.adjustedConfidenceThreshold,
        adjustedMaxTradesPerDay: futuresThrottle.adjustedMaxTradesPerDay
      },
      futuresDefense: {
        status: futuresDefense.status,
        action: futuresDefense.action,
        targetSymbol: futuresDefense.targetSymbol,
        summary: futuresDefense.summary,
        reasons: futuresDefense.reasons,
        liveLiquidationBufferPercent: futuresDefense.liveLiquidationBufferPercent
      },
      error: aiDecision.error
    });

    await this.persistSnapshot(workspaceId, snapshot);

    if (futuresDefense.action !== "HOLD" && futuresDefense.targetPositionId) {
      const defensivePosition = await prisma.position.findUnique({ where: { id: futuresDefense.targetPositionId } });
      if (defensivePosition && defensivePosition.workspaceId === workspaceId) {
        const defenseResult = await this.applyPositionAdjustment(workspaceId, snapshot, defensivePosition as typeof defensivePosition & { workspaceId: string }, {
          action: futuresDefense.action === "CLOSE" ? "close" : "reduce",
          reduceFraction: futuresDefense.targetReduceFraction ?? 0.25,
          signalSummary: `Automated futures defense ${futuresDefense.action === "CLOSE" ? "close" : "reduce"} from strategy runner`,
          riskSummary: futuresDefense.reasons.join(" ") || futuresDefense.summary,
          strategyLabel: `${snapshot.strategy.selectedStrategy} / Futures Defense`,
          jobType: futuresDefense.action === "CLOSE" ? "kraken.futures.paper.defense.close" : "kraken.futures.paper.defense.reduce",
          logStream: "risk",
          logLevel: "warning",
          logMessage: futuresDefense.action === "CLOSE"
            ? `Futures defense closed ${defensivePosition.symbol}.`
            : `Futures defense reduced ${defensivePosition.symbol}.`,
          successMessage: futuresDefense.action === "CLOSE"
            ? `Strategy cycle applied futures defense and closed ${defensivePosition.symbol}.`
            : `Strategy cycle applied futures defense and reduced ${defensivePosition.symbol}.`,
          meta: {
            posture: futuresDefense.posture,
            defenseAction: futuresDefense.action,
            defenseScore: futuresDefense.score,
            defenseReasons: futuresDefense.reasons,
            trigger
          }
        });

        snapshot.strategy.runner.lastTradeAt = now;
        snapshot.strategy.runner.latestSummary = defenseResult.message;
        snapshot.strategy.ai.futuresDefense = {
          ...futuresDefense,
          status: defenseResult.action === "close" ? "Closed" : "Reduced",
          summary: defenseResult.message,
          appliedAt: now
        };
        snapshot.strategy.eventHistory = [
          {
            id: generateId("EVT"),
            type: defenseResult.action === "close" ? "Futures Defense Close" : "Futures Defense Reduce",
            symbol: defensivePosition.symbol,
            action: defensivePosition.side,
            confidence: null,
            outcome: defenseResult.message,
            timestamp: now
          },
          ...snapshot.strategy.eventHistory
        ].slice(0, 12);

        const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
        return { ok: true, message: defenseResult.message, snapshot: nextSnapshot };
      }
    }

    if (!snapshot.strategy.runner.enabled && trigger !== "manual") {
      const nextSnapshot = await this.getSnapshot(false);
      return { ok: true, message: "Strategy cycle completed.", snapshot: nextSnapshot };
    }

    if (!topCandidate) {
      const nextSnapshot = await this.getSnapshot(false);
      const noTradeMessage = accountMode === "futures" && futuresThrottle.blockNewEntries
        ? `Strategy cycle completed. Futures throttle held new entries: ${futuresThrottle.summary}`
        : "Strategy cycle completed. No trade edge found.";
      return { ok: true, message: noTradeMessage, snapshot: nextSnapshot };
    }

    if (todaysExecutedTradesByMode >= effectiveMaxTradesPerDay) {
      snapshot.strategy.runner.latestSummary = effectiveMaxTradesPerDay === 0
        ? `Runner skipped because futures throttle is ${futuresThrottle.posture.toLowerCase()} and no new futures entries are allowed right now.`
        : `Runner skipped because the effective max of ${effectiveMaxTradesPerDay} auto trade${effectiveMaxTradesPerDay === 1 ? "" : "s"} for ${accountModeLabel(accountMode).toLowerCase()} mode has been reached.`;
      await this.appendLog(workspaceId, "risk", "warning", "Strategy runner hit the mode-aware auto-trade cap.", {
        accountMode,
        todaysExecutedTradesByMode,
        effectiveMaxTradesPerDay,
        configuredMaxTradesPerDay: snapshot.strategy.runner.maxTradesPerDay,
        trigger,
        selectedCandidateId: topCandidate.id,
        futuresThrottle: accountMode === "futures" ? futuresThrottle : null
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: snapshot.strategy.runner.latestSummary, snapshot: nextSnapshot };
    }

    const effectiveConsecutiveLosses = accountMode === "futures"
      ? Math.max(consecutiveLosses, consecutiveLossesByMode, futuresThrottle.lossStreak)
      : consecutiveLosses;

    if (effectiveConsecutiveLosses >= snapshot.strategy.runner.cooldownAfterLosses) {
      snapshot.strategy.runner.latestSummary = `Runner skipped because cooldown is active after ${effectiveConsecutiveLosses} consecutive losses.`;
      await this.appendLog(workspaceId, "risk", "warning", "Strategy runner cooldown activated after consecutive losses.", {
        accountMode,
        consecutiveLosses,
        consecutiveLossesByMode,
        effectiveConsecutiveLosses,
        cooldownAfterLosses: snapshot.strategy.runner.cooldownAfterLosses,
        trigger,
        selectedCandidateId: topCandidate.id
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: snapshot.strategy.runner.latestSummary, snapshot: nextSnapshot };
    }

    if (accountMode === "futures" && futuresThrottle.blockNewEntries) {
      snapshot.strategy.runner.latestSummary = `Runner skipped because futures throttle is ${futuresThrottle.posture.toLowerCase()}. ${futuresThrottle.summary}`;
      await this.appendLog(workspaceId, "risk", "warning", "Strategy runner blocked a futures entry due to mode-specific attribution pressure.", {
        trigger,
        selectedCandidateId: topCandidate.id,
        symbol: topCandidate.symbol,
        futuresThrottle
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: snapshot.strategy.runner.latestSummary, snapshot: nextSnapshot };
    }

    if (allocationPlan?.blockNewEntries) {
      snapshot.strategy.runner.latestSummary = allocationPlan.summary;
      await this.appendLog(workspaceId, "risk", "warning", `Strategy runner blocked ${topCandidate.symbol} due to portfolio allocation pressure.`, {
        trigger,
        selectedCandidateId: topCandidate.id,
        symbol: topCandidate.symbol,
        allocationPlan
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: allocationPlan.summary, snapshot: nextSnapshot };
    }

    if (snapshot.positions.some((position) => position.symbol === topCandidate.symbol)) {
      const nextSnapshot = await this.getSnapshot(false);
      await this.appendLog(workspaceId, "execution", "info", `Runner skipped ${topCandidate.symbol} because an open position already exists.`, {
        symbol: topCandidate.symbol,
        trigger,
        selectedCandidateId: topCandidate.id,
        strategyModule: topCandidate.module,
        accountMode
      });
      return { ok: true, message: `Strategy cycle completed. Existing ${topCandidate.symbol} position kept open.`, snapshot: nextSnapshot };
    }

    const throttledSizeMultiplier = accountMode === "futures"
      ? (aiDecision.sizeMultiplier ?? topCandidate.sizeMultiplier) * futuresThrottle.sizeFactor
      : (aiDecision.sizeMultiplier ?? topCandidate.sizeMultiplier);
    const allocationAdjustedSizeMultiplier = throttledSizeMultiplier * (allocationPlan?.recommendedSizeMultiplier ?? 1);
    const requestedLeverage = accountMode === "futures"
      ? Math.min(snapshot.settings.exchange.futuresLeverage, futuresThrottle.leverageCap, allocationPlan?.leverageCap ?? snapshot.settings.exchange.futuresLeverage)
      : 1;

    const order = this.computeStrategyOrder(topCandidate.symbol, topCandidate.action, topCandidate.price, snapshot, {
      sizeMultiplier: allocationAdjustedSizeMultiplier,
      stopLossPercent: aiDecision.stopLossPercent ?? topCandidate.stopLossPercent,
      takeProfitPercent: aiDecision.takeProfitPercent ?? topCandidate.takeProfitPercent,
      atrPercent: topContext?.atr15mPercent ?? topCandidate.atrPercent,
      executionQuality: topContext?.executionQuality ?? topCandidate.executionQuality,
      liquidityUsd: topContext?.liquidityUsd ?? topCandidate.liquidityUsd,
      volatilityPercent: topContext?.realizedVolatilityPercent ?? topContext?.atr15mPercent ?? topCandidate.volatilityPercent,
      requestedLeverage
    });
    snapshot.strategy.marketConditions = {
      ...snapshot.strategy.marketConditions,
      "Portfolio Allocation": allocationPlan ? allocationPlan.status : "Idle",
      "Allocation Detail": allocationPlan ? `${Math.round(allocationPlan.recommendedSizeMultiplier * 100)}% size · ${allocationPlan.targetBucket ?? "—"}` : "Monitoring"
    };
    if (allocationPlan) {
      snapshot.strategy.ai.portfolioAllocation = { ...allocationPlan, appliedAt: now };
    }
    if (allocationPlan) {
      snapshot.strategy.aiCommentary = [
        {
          label: "Portfolio Allocation",
          tone: allocationPlan.status === "Blocked" ? "cautious" : allocationPlan.status === "Constrained" ? "neutral" : "positive",
          timestamp: now,
          body: allocationPlan.summary
        },
        ...snapshot.strategy.aiCommentary.filter((item) => item.label !== "Portfolio Allocation")
      ].slice(0, 5);
    }

    if (order.size <= 0 || order.notional <= 0) {
      const nextSnapshot = await this.getSnapshot(false);
      await this.appendLog(workspaceId, "risk", "warning", `Runner skipped ${topCandidate.symbol} because order sizing resolved to zero.`, {
        symbol: topCandidate.symbol,
        price: topCandidate.price,
        selectedCandidateId: topCandidate.id,
        strategyModule: topCandidate.module
      });
      return { ok: false, message: `Strategy cycle completed but could not size ${topCandidate.symbol}.`, snapshot: nextSnapshot };
    }

    const executionBlocker = topContext ? this.getStrategyExecutionBlocker(snapshot, topCandidate, topContext, order) : null;
    if (executionBlocker) {
      snapshot.strategy.runner.latestSummary = `Runner skipped ${topCandidate.symbol}: ${executionBlocker}`;
      await this.appendLog(workspaceId, "risk", "warning", `Strategy runner rejected ${topCandidate.symbol} on execution-quality filters.`, {
        symbol: topCandidate.symbol,
        selectedCandidateId: topCandidate.id,
        reason: executionBlocker,
        spreadBps: topContext?.spreadBps ?? null,
        liquidityUsd: topContext?.liquidityUsd ?? null,
        executionQuality: topContext?.executionQuality ?? null,
        orderPreview: order
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: executionBlocker, snapshot: nextSnapshot };
    }

    const strategyLabel = `${snapshot.strategy.selectedStrategy} / ${aiDecision.strategyModule ?? topCandidate.module}`;
    const tradeResult = await this.executeTrade({
      symbol: topCandidate.symbol,
      side: topCandidate.action,
      size: order.size,
      orderType: "market",
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      accountMode: order.accountMode,
      leverage: order.leverage,
      liquidationPrice: order.liquidationPrice,
      liquidationDistancePercent: order.liquidationDistancePercent,
      signalSummary: `${topCandidate.summary} Trigger=${trigger}. Candidate=${topCandidate.id}. Module=${aiDecision.strategyModule ?? topCandidate.module}. Bias=${aiDecision.executionBias ?? "Balanced"}. ATR=${(topContext?.atr15mPercent ?? topCandidate.atrPercent).toFixed(2)}%. Spread=${(topContext?.spreadBps ?? topCandidate.spreadBps).toFixed(1)}bps. ExecQ=${Math.round((topContext?.executionQuality ?? topCandidate.executionQuality) * 100)}%. Mode=${accountMode}. Throttle=${accountMode === "futures" ? futuresThrottle.posture : "Normal"}. Allocation=${allocationPlan ? `${Math.round(allocationPlan.recommendedSizeMultiplier * 100)}% ${allocationPlan.targetBucket}` : "100% normal"}. LeverageCap=${accountMode === "futures" ? `${Math.min(futuresThrottle.leverageCap, allocationPlan?.leverageCap ?? futuresThrottle.leverageCap)}x` : "1x"}.`,
      strategy: strategyLabel
    });

    const afterTradeSnapshot = tradeResult.snapshot;
    this.ensureRunnerState(afterTradeSnapshot);
    afterTradeSnapshot.strategy.selectedStrategy = snapshot.strategy.selectedStrategy;
    afterTradeSnapshot.strategy.runner.lastTradeAt = tradeResult.ok ? now : afterTradeSnapshot.strategy.runner.lastTradeAt;
    afterTradeSnapshot.strategy.runner.latestSummary = tradeResult.ok
      ? `Runner executed ${topCandidate.symbol} ${topCandidate.action} via ${aiDecision.strategyModule ?? topCandidate.module} at ${Math.round(topCandidate.confidence * 100)}% confidence.`
      : `Runner found ${topCandidate.symbol} ${topCandidate.action}, but execution was blocked: ${tradeResult.message}`;
    afterTradeSnapshot.strategy.eventHistory = [
      {
        id: generateId("EVT"),
        type: `${aiDecision.strategyModule ?? topCandidate.module} Auto Execution`,
        symbol: topCandidate.symbol,
        action: topCandidate.action,
        confidence: topCandidate.confidence,
        outcome: tradeResult.ok ? "Executed" : `Blocked: ${tradeResult.message}`,
        timestamp: now
      },
      ...afterTradeSnapshot.strategy.eventHistory
    ].slice(0, 12);

    await this.persistSnapshot(workspaceId, afterTradeSnapshot);
    const nextSnapshot = await this.getSnapshot(false);
    return {
      ok: tradeResult.ok,
      message: tradeResult.ok
        ? `Strategy cycle executed ${topCandidate.symbol} ${topCandidate.action}.`
        : `Strategy cycle found a setup but execution failed: ${tradeResult.message}`,
      snapshot: nextSnapshot
    };
  };

  private async hydrateSnapshot(base: ProofTraderSnapshot, workspaceId: string): Promise<ProofTraderSnapshot> {
    base.risk.policy = normalizeRiskPolicy(base.risk.policy);
    this.ensureRunnerState(base);
    base.settings.exchange.accountMode = base.settings.exchange.accountMode ?? "spot";
    base.settings.exchange.futuresLeverage = Math.max(Math.round(base.settings.exchange.futuresLeverage ?? 2), 1);
    base.paper.accountMode = base.paper.accountMode ?? base.settings.exchange.accountMode;
    base.paper.leverage = base.paper.leverage ?? accountLeverage(base.settings.exchange.accountMode, base.settings.exchange.futuresLeverage);

    const [trades, positions, artifacts, logs, jobs, blockedIntents] = await Promise.all([
      prisma.tradeExecution.findMany({ where: { workspaceId }, orderBy: { openedAt: "desc" } }),
      prisma.position.findMany({ where: { workspaceId }, orderBy: { openedAt: "desc" } }),
      prisma.validationArtifact.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } }),
      prisma.logEntry.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.jobRun.findMany({ where: { workspaceId }, orderBy: { startedAt: "desc" }, take: 50 }),
      prisma.tradeIntent.findMany({ where: { workspaceId, status: "BLOCKED" }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);

    let mappedTrades: TradeRecord[] = trades.map((trade) => ({
      id: trade.id,
      accountMode: inferTradeAccountMode(trade),
      symbol: trade.symbol,
      side: trade.side,
      size: trade.size,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss ?? 0,
      takeProfit: trade.takeProfit ?? 0,
      status: trade.status,
      openedAt: formatDate(trade.openedAt) ?? trade.openedAt.toISOString(),
      closedAt: formatDate(trade.closedAt),
      realizedPnL: trade.realizedPnL,
      unrealizedPnL: trade.unrealizedPnL,
      fees: trade.fees,
      exchangeOrderId: trade.exchangeOrderId,
      strategy: trade.strategy,
      signalSummary: trade.signalSummary,
      riskSummary: trade.riskSummary,
      artifactId: trade.artifactId
    }));

    const mappedPositions: PositionRecord[] = positions.map((position) => ({
      id: position.id,
      accountMode: inferPositionAccountMode(position),
      symbol: position.symbol,
      side: position.side,
      size: position.size,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      stopLoss: position.stopLoss ?? 0,
      takeProfit: position.takeProfit ?? 0,
      unrealizedPnL: position.unrealizedPnL,
      unrealizedPnLPercent: position.unrealizedPnLPercent,
      collateral: position.collateral,
      leverage: position.leverage,
      liquidationPrice: position.liquidationPrice,
      openedAt: formatDate(position.openedAt) ?? position.openedAt.toISOString(),
      riskScore: position.riskScore
    }));

    const mappedArtifacts = artifacts.map((artifact) => ({
      id: artifact.id,
      type: artifact.type,
      intentHash: artifact.intentHash,
      signatureStatus: artifact.signatureStatus,
      checkpointStatus: artifact.checkpointStatus,
      onchainReference: artifact.onchainReference,
      createdAt: formatDate(artifact.createdAt) ?? artifact.createdAt.toISOString(),
      validatorStatus: artifact.validatorStatus,
      tradeId: artifact.tradeId,
      riskCheckId: artifact.riskCheckId
    }));

    if (mappedTrades.length === 0 && base.paper.recentOrders.length > 0) {
      mappedTrades = base.paper.recentOrders.map((order) => ({
        id: order.id,
        accountMode: order.accountMode,
        symbol: order.symbol,
        side: order.side,
        size: order.size,
        entryPrice: order.price,
        exitPrice: order.price,
        stopLoss: 0,
        takeProfit: 0,
        status: order.status.toLowerCase().includes("cancel") ? "Cancelled" : "Closed",
        openedAt: order.timestamp,
        closedAt: order.timestamp,
        realizedPnL: 0,
        unrealizedPnL: 0,
        fees: 0,
        exchangeOrderId: order.exchangeOrderId ?? order.id,
        strategy: "Kraken Paper History",
        signalSummary: "Imported from Kraken paper history.",
        riskSummary: "External paper order synced from Kraken CLI.",
        artifactId: null
      }));
    }

    const closedTrades = mappedTrades.filter((trade) => trade.status === "Closed");
    const winningTrades = closedTrades.filter((trade) => trade.realizedPnL > 0);
    const losingTrades = closedTrades.filter((trade) => trade.realizedPnL < 0);
    const winRate = closedTrades.length === 0 ? 0 : round((winningTrades.length / closedTrades.length) * 100, 1);
    const realizedToday = closedTrades.filter((trade) => trade.closedAt && sameDay(new Date(trade.closedAt))).reduce((sum, trade) => sum + trade.realizedPnL, 0);
    const realizedWeek = closedTrades.filter((trade) => trade.closedAt && withinDays(new Date(trade.closedAt), 7)).reduce((sum, trade) => sum + trade.realizedPnL, 0);
    const openUnrealized = mappedPositions.reduce((sum, position) => sum + position.unrealizedPnL, 0);

    const availableBalanceCard = base.dashboard.metricCards.find((item) => item.label === "Available Balance");
    const storedAvailableBalance = availableBalanceCard ? availableBalanceCard.value : 0;
    const availableBalance = base.settings.exchange.paperTrading && base.paper.initialized
      ? round(base.paper.balance, 2)
      : round(storedAvailableBalance, 2);
    const hasOpenExposure = mappedPositions.length > 0;
    const totalEquity = base.settings.exchange.paperTrading && base.paper.initialized
      ? round(hasOpenExposure ? (base.paper.equity > 0 ? base.paper.equity : availableBalance + openUnrealized) : availableBalance, 2)
      : round(availableBalance + openUnrealized, 2);

    const equityCurve = buildEquityCurve(mappedTrades, totalEquity, openUnrealized);
    const maxDrawdown = computeMaxDrawdown(equityCurve);
    const sharpeRatio = computeSharpeStyleMetric(equityCurve);
    const performance = buildPerformanceSnapshot(equityCurve);
    const attributionByMode = {
      spot: buildModeAttribution("spot", mappedTrades, mappedPositions),
      futures: buildModeAttribution("futures", mappedTrades, mappedPositions)
    };

    const publishErrors = logs.filter((item) => item.stream === "publish" && item.level === "error").length;
    const failedJobs = jobs.filter((job) => job.status === "Failed").length;
    const runningJobs = jobs.filter((job) => job.status === "Running").length;
    const unresolvedRiskEvents = logs.filter((item) => (item.stream === "risk" || item.stream === "error") && (item.level === "warning" || item.level === "error")).slice(0, 6);
    const lastLossStreak = (() => {
      let streak = 0;
      for (const trade of closedTrades) {
        if (trade.realizedPnL < 0) streak += 1;
        else break;
      }
      return streak;
    })();

    const spotPositions = mappedPositions.filter((position) => position.accountMode === "spot");
    const futuresPositions = mappedPositions.filter((position) => position.accountMode === "futures");
    const largestSpotPosition = spotPositions.reduce((max, position) => Math.max(max, position.collateral), 0);
    const openFuturesNotional = futuresPositions.reduce((sum, position) => sum + position.currentPrice * position.size, 0);
    const minFuturesLiquidationBuffer = futuresPositions.reduce((min, position) => {
      const distance = calculateLiquidationDistancePercent(position.entryPrice, position.liquidationPrice);
      if (distance == null) return min;
      return Math.min(min, distance);
    }, Number.POSITIVE_INFINITY);
    const largestSpread = mappedPositions.reduce((max, position) => {
      if (!position.currentPrice) return max;
      const spreadPercent = Math.abs(((position.currentPrice - position.entryPrice) / position.entryPrice) * 100);
      return Math.max(max, spreadPercent);
    }, 0);
    const realizedTodayFutures = closedTrades
      .filter((trade) => trade.accountMode === "futures" && trade.closedAt && sameDay(new Date(trade.closedAt)))
      .reduce((sum, trade) => sum + trade.realizedPnL, 0);

    const riskChecks = [
      {
        id: generateId("CHK"),
        check: "Daily Loss Guardrail",
        status: Math.abs(Math.min(realizedToday, 0)) >= base.risk.policy.maxDailyLossUsd ? "Breached" : "Passed",
        value: `$${Math.abs(Math.min(realizedToday, 0)).toFixed(2)}`,
        limit: `$${base.risk.policy.maxDailyLossUsd.toFixed(2)}`,
        utilization: round((Math.abs(Math.min(realizedToday, 0)) / Math.max(base.risk.policy.maxDailyLossUsd, 1)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Spot Max Position Size",
        status: largestSpotPosition > base.risk.policy.maxPositionSizeUsd ? "Breached" : "Passed",
        value: `$${largestSpotPosition.toFixed(2)}`,
        limit: `$${base.risk.policy.maxPositionSizeUsd.toFixed(2)}`,
        utilization: round((largestSpotPosition / Math.max(base.risk.policy.maxPositionSizeUsd, 1)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Futures Daily Loss",
        status: Math.abs(Math.min(realizedTodayFutures, 0)) >= base.risk.policy.futuresMaxDailyLossUsd ? "Breached" : futuresPositions.length > 0 ? "Passed" : "Idle",
        value: `$${Math.abs(Math.min(realizedTodayFutures, 0)).toFixed(2)}`,
        limit: `$${base.risk.policy.futuresMaxDailyLossUsd.toFixed(2)}`,
        utilization: round((Math.abs(Math.min(realizedTodayFutures, 0)) / Math.max(base.risk.policy.futuresMaxDailyLossUsd, 1)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Futures Open Notional",
        status: openFuturesNotional > base.risk.policy.futuresMaxOpenNotionalUsd ? "Breached" : futuresPositions.length > 0 ? "Passed" : "Idle",
        value: `$${openFuturesNotional.toFixed(2)}`,
        limit: `$${base.risk.policy.futuresMaxOpenNotionalUsd.toFixed(2)}`,
        utilization: round((openFuturesNotional / Math.max(base.risk.policy.futuresMaxOpenNotionalUsd, 1)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Futures Liquidation Buffer",
        status: futuresPositions.length === 0 ? "Idle" : minFuturesLiquidationBuffer < base.risk.policy.futuresMinLiquidationDistancePercent ? "Warning" : "Passed",
        value: futuresPositions.length === 0 ? "—" : `${minFuturesLiquidationBuffer.toFixed(2)}%`,
        limit: `${base.risk.policy.futuresMinLiquidationDistancePercent.toFixed(2)}%`,
        utilization: futuresPositions.length === 0 ? 0 : round((base.risk.policy.futuresMinLiquidationDistancePercent / Math.max(minFuturesLiquidationBuffer, 0.01)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Concurrent Positions",
        status: mappedPositions.length > base.risk.policy.maxConcurrentPositions ? "Breached" : "Passed",
        value: String(mappedPositions.length),
        limit: String(base.risk.policy.maxConcurrentPositions),
        utilization: round((mappedPositions.length / Math.max(base.risk.policy.maxConcurrentPositions, 1)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Loss Cooldown",
        status: lastLossStreak >= base.risk.policy.cooldownAfterLosses ? "Cooling Down" : "Passed",
        value: `${lastLossStreak} losses`,
        limit: `${base.risk.policy.cooldownAfterLosses} losses`,
        utilization: round((lastLossStreak / Math.max(base.risk.policy.cooldownAfterLosses, 1)) * 100, 1),
        timestamp: new Date().toISOString()
      },
      {
        id: generateId("CHK"),
        check: "Volatility Guardrail",
        status: largestSpread > base.risk.policy.volatilityGuardrailPercent ? "Warning" : "Passed",
        value: `${largestSpread.toFixed(2)}%`,
        limit: `${base.risk.policy.volatilityGuardrailPercent.toFixed(2)}%`,
        utilization: round((largestSpread / Math.max(base.risk.policy.volatilityGuardrailPercent, 0.01)) * 100, 1),
        timestamp: new Date().toISOString()
      }
    ];

    const riskEvents = unresolvedRiskEvents.map((item) => ({
      id: item.id,
      type: item.stream === "error" ? "System Error" : "Risk Alert",
      severity: item.level === "error" ? "High" as const : "Medium" as const,
      message: item.message,
      timestamp: item.createdAt.toISOString(),
      resolved: false
    }));

    const publishedArtifacts = mappedArtifacts.filter((item) => item.validatorStatus === "Published").length;
    const publishRate = mappedArtifacts.length === 0 ? 0 : round((publishedArtifacts / mappedArtifacts.length) * 100, 1);
    const trustScore = round(clamp((winRate * 0.45) + (publishRate * 0.35) + (Math.max(0, 100 + maxDrawdown) * 0.2), 0, 100), 1);
    const recentSignals = base.dashboard.recentSignals.slice(0, 8);
    const eventHistory = base.strategy.eventHistory.slice(0, 12);

    base.generatedAt = new Date().toISOString();
    base.system.environment = base.settings.exchange.paperTrading ? "Paper Trading" : "Production";
    const accountMode = base.settings.exchange.accountMode ?? "spot";
    const leverageLabel = accountMode === "futures" ? `${base.settings.exchange.futuresLeverage}x` : "1x";
    base.dashboard.equityCurve = equityCurve;
    base.dashboard.openPositionsPreview = mappedPositions;
    base.dashboard.recentTradesPreview = mappedTrades.slice(0, 3);
    base.dashboard.recentArtifacts = mappedArtifacts.slice(0, 3);
    base.dashboard.recentSignals = recentSignals;
    base.dashboard.totalTrades = Math.max(mappedTrades.length, base.paper.tradeCount);
    base.dashboard.winRate = winRate;
    base.dashboard.maxDrawdown = maxDrawdown;
    base.dashboard.sharpeRatio = sharpeRatio;
    base.dashboard.metricCards = [
      { label: "Total Equity", value: totalEquity, format: "currency", suffix: `${base.system.environment} ${accountModeLabel(accountMode)}` },
      { label: "Available Balance", value: availableBalance, format: "currency", suffix: base.settings.exchange.paperTrading ? `${accountModeLabel(accountMode)} paper cash` : "Exchange cash" },
      { label: "Daily PnL", value: round(realizedToday, 2), format: "currency", suffix: "Today" },
      { label: "Weekly PnL", value: round(realizedWeek, 2), format: "currency", suffix: "7d" }
    ];
    base.dashboard.attributionByMode = attributionByMode;

    base.trades = mappedTrades;
    base.positions = mappedPositions;
    base.paper = {
      ...base.paper,
      status: base.settings.exchange.paperTrading ? base.paper.status : "idle",
      accountMode,
      leverage: accountLeverage(accountMode, base.settings.exchange.futuresLeverage),
      source: base.paper.source ?? "snapshot",
      initialized: base.settings.exchange.paperTrading ? base.paper.initialized : false,
      equity: totalEquity,
      balance: availableBalance,
      unrealizedPnL: round(openUnrealized, 2),
      tradeCount: Math.max(base.paper.tradeCount, mappedTrades.length),
      openPositionCount: mappedPositions.length,
      recentOrders: base.paper.recentOrders.slice(0, 8)
    };
    base.validation.artifacts = mappedArtifacts;
    base.validation.totalProofs = mappedArtifacts.length;
    base.validation.publishRate = publishRate;
    base.validation.trustScore = trustScore;
    base.validation.identity.agentWallet = base.settings.identity.agentWallet;
    base.validation.identity.network = base.settings.blockchain.network;
    base.validation.activeSince = mappedArtifacts[mappedArtifacts.length - 1]?.createdAt ?? mappedTrades[mappedTrades.length - 1]?.openedAt ?? base.generatedAt;
    base.validation.reputationSummary = [
      { label: "Success rate", value: `${winRate.toFixed(1)}%` },
      { label: "Trading yield (30d)", value: `$${round(closedTrades.reduce((sum, trade) => sum + trade.realizedPnL, 0), 2).toFixed(2)}` },
      { label: "Validation average", value: `${publishRate.toFixed(1)}%` },
      { label: "Endpoint uptime", value: failedJobs === 0 ? "Stable" : `${failedJobs} failed job${failedJobs === 1 ? "" : "s"}` }
    ];
    base.logs = {
      ...groupLogs(logs.map((item) => ({
        id: item.id,
        stream: item.stream,
        createdAt: item.createdAt,
        level: item.level,
        message: item.message,
        details: item.details
      }))),
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        startedAt: job.startedAt.toISOString()
      }))
    };

    base.risk.checks = riskChecks;
    base.risk.events = riskEvents;
    base.risk.blockedTradeIntents = blockedIntents.map((intent) => ({
      id: intent.id,
      symbol: intent.symbol,
      side: intent.side,
      reason: intent.blockReason ?? intent.riskSummary,
      riskScore: intent.riskScore,
      timestamp: intent.createdAt.toISOString()
    }));
    base.risk.blockedTrades24h = blockedIntents.filter((intent) => withinDays(intent.createdAt, 1)).length;

    base.strategy.allowedSymbols = [...base.risk.policy.whitelistedMarkets];
    base.strategy.performance = performance;
    base.strategy.eventHistory = eventHistory;
    base.strategy.executedToday = mappedTrades.filter((trade) => sameDay(new Date(trade.openedAt))).length;
    base.strategy.blockedToday = blockedIntents.filter((intent) => sameDay(intent.createdAt)).length;
    base.strategy.signalsToday = recentSignals.filter((signal) => sameDay(new Date(signal.time))).length;
    base.strategy.readiness = base.strategy.paused ? "Paused" : base.strategy.runner.enabled ? "Auto Running" : base.settings.exchange.connected ? "Ready" : "Exchange disconnected";
    base.strategy.runner.status = base.strategy.runner.enabled ? base.strategy.runner.status : "Stopped";
    base.risk.circuitBreaker = base.strategy.paused ? "Paused" : riskChecks.some((check) => check.status === "Breached") ? "Paused" : "Normal";

    const notifications = base.logs.error.length + base.logs.risk.filter((item) => item.level !== "info").length;
    base.system.notifications = notifications;
    base.system.connections.exchangeConnected = base.settings.exchange.connected;
    base.system.connections.websocketConnected = base.settings.exchange.connected;
    base.system.connections.chainSynced = Boolean(base.settings.blockchain.rpcEndpoint);
    base.system.connections.publishWorkerHealthy = publishErrors === 0;
    base.system.connections.queueHealthy = runningJobs <= 5 && failedJobs === 0;
    base.system.connections.lastSyncLabel = formatSyncLabel(base.paper.syncedAt ? new Date(base.paper.syncedAt) : null);
    base.system.connections.rateLimitAvailable = base.settings.exchange.connected
      ? (base.settings.exchange.paperTrading ? `${accountModeLabel(accountMode)} paper engine ${leverageLabel}` : "Kraken CLI active")
      : "Disconnected";
    base.system.healthLabel = !base.settings.exchange.connected
      ? "Exchange disconnected"
      : base.paper.status === "error"
        ? "Paper sync degraded"
        : publishErrors > 0 || failedJobs > 0
          ? "Attention required"
          : "All systems operational";

    return base;
  }

  private async persistAndHydrate(workspaceId: string, snapshot: ProofTraderSnapshot) {
    await this.persistSnapshot(workspaceId, snapshot);
    return this.getSnapshot(false);
  }

  getSnapshot = async (syncPaper = false): Promise<ProofTraderSnapshot> => {
    const { workspaceId, snapshot } = await this.loadWorkspaceSnapshot();
    if (syncPaper) {
      const result = await this.reconcilePaperState(workspaceId, snapshot, { persist: true, logErrors: true });
      return this.hydrateSnapshot(result.snapshot, workspaceId);
    }
    return this.hydrateSnapshot(snapshot, workspaceId);
  };

  testExchange = async (): Promise<AppMessage> => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot();
    if (!snapshot.settings.exchange.connected) {
      return { ok: false, message: "Kraken connection is disabled in settings." };
    }

    try {
      const status = await krakenCliService.status();
      await this.appendLog(workspaceId, "execution", "success", "Kraken connection test passed.", { status });
      return { ok: true, message: "Kraken connection test passed." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Kraken CLI error.";
      await this.appendLog(workspaceId, "error", "error", "Kraken connection test failed.", { error: message });
      return { ok: false, message };
    }
  };

  updateSettings = async (input: Partial<SettingsState>) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot();
    snapshot.settings = {
      ...snapshot.settings,
      ...input,
      exchange: { ...snapshot.settings.exchange, ...input.exchange },
      blockchain: { ...snapshot.settings.blockchain, ...input.blockchain },
      notifications: { ...snapshot.settings.notifications, ...input.notifications },
      identity: { ...snapshot.settings.identity, ...input.identity },
      team: input.team ?? snapshot.settings.team
    };

    snapshot.risk.policy = normalizeRiskPolicy(snapshot.risk.policy);
    snapshot.settings.exchange.futuresLeverage = Math.min(Math.max(Math.round(snapshot.settings.exchange.futuresLeverage ?? 2), 1), snapshot.risk.policy.futuresMaxLeverage);
    snapshot.system.connections.exchangeConnected = snapshot.settings.exchange.connected;
    snapshot.validation.identity.agentWallet = snapshot.settings.identity.agentWallet;
    snapshot.validation.identity.network = snapshot.settings.blockchain.network;

    snapshot.paper.accountMode = snapshot.settings.exchange.accountMode;
    snapshot.paper.leverage = accountLeverage(snapshot.settings.exchange.accountMode, snapshot.settings.exchange.futuresLeverage);

    await this.appendLog(workspaceId, "execution", "success", "Settings saved.", {
      paperTrading: snapshot.settings.exchange.paperTrading,
      connected: snapshot.settings.exchange.connected,
      accountMode: snapshot.settings.exchange.accountMode,
      futuresLeverage: snapshot.settings.exchange.futuresLeverage
    });

    return this.persistAndHydrate(workspaceId, snapshot);
  };

  updateRiskPolicy = async (policy: RiskPolicy) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot();
    snapshot.risk.policy = normalizeRiskPolicy(policy);
    snapshot.settings.exchange.futuresLeverage = Math.min(snapshot.settings.exchange.futuresLeverage, snapshot.risk.policy.futuresMaxLeverage);
    await this.appendLog(workspaceId, "risk", "success", "Risk policy updated.", { policy: snapshot.risk.policy });
    return this.persistAndHydrate(workspaceId, snapshot);
  };

  updateStrategyRunnerConfig = async (input: Partial<StrategyRunnerConfigRequest>) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(false);
    this.ensureRunnerState(snapshot);

    const normalizeSymbols = (symbols?: string[]) => {
      const cleaned = (symbols ?? [])
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
      return Array.from(new Set(cleaned));
    };

    const nextWatchedSymbols = input.watchedSymbols
      ? normalizeSymbols(input.watchedSymbols)
      : snapshot.strategy.runner.watchedSymbols;

    snapshot.strategy.runner = {
      ...snapshot.strategy.runner,
      cadenceSeconds: input.cadenceSeconds != null ? Math.max(Math.round(input.cadenceSeconds), 10) : snapshot.strategy.runner.cadenceSeconds,
      confidenceThreshold: input.confidenceThreshold != null
        ? clamp(input.confidenceThreshold, 0.5, 0.95)
        : snapshot.strategy.runner.confidenceThreshold,
      tradeSizeUsd: input.tradeSizeUsd != null ? Math.max(input.tradeSizeUsd, 50) : snapshot.strategy.runner.tradeSizeUsd,
      maxTradesPerDay: input.maxTradesPerDay != null ? Math.max(Math.round(input.maxTradesPerDay), 1) : snapshot.strategy.runner.maxTradesPerDay,
      cooldownAfterLosses: input.cooldownAfterLosses != null
        ? Math.max(Math.round(input.cooldownAfterLosses), 1)
        : snapshot.strategy.runner.cooldownAfterLosses,
      watchedSymbols: nextWatchedSymbols.length > 0 ? nextWatchedSymbols : snapshot.strategy.runner.watchedSymbols
    };

    snapshot.risk.policy.cooldownAfterLosses = snapshot.strategy.runner.cooldownAfterLosses;
    snapshot.strategy.allowedSymbols = [...snapshot.strategy.runner.watchedSymbols];
    snapshot.risk.policy.whitelistedMarkets = [...snapshot.strategy.runner.watchedSymbols];
    snapshot.strategy.positionSizing = `$${round(snapshot.strategy.runner.tradeSizeUsd, 2).toFixed(2)} base ticket size, scaled by bounded AI multipliers, portfolio allocation pressure, and ${(snapshot.strategy.runner.confidenceThreshold * 100).toFixed(0)}% minimum confidence.`;
    snapshot.strategy.executionPolicy = `Scan every ${snapshot.strategy.runner.cadenceSeconds}s, let the AI rank bounded candidates, cap at ${snapshot.strategy.runner.maxTradesPerDay} auto trade${snapshot.strategy.runner.maxTradesPerDay === 1 ? "" : "s"} per day, cooldown after ${snapshot.strategy.runner.cooldownAfterLosses} consecutive loss${snapshot.strategy.runner.cooldownAfterLosses === 1 ? "" : "es"}, and taper new entries when mode or bucket concentration gets heavy.`;
    snapshot.strategy.runner.latestSummary = `Runner settings saved. ${snapshot.strategy.runner.watchedSymbols.length} watched symbol${snapshot.strategy.runner.watchedSymbols.length === 1 ? "" : "s"}, ${(snapshot.strategy.runner.confidenceThreshold * 100).toFixed(0)}% threshold, $${round(snapshot.strategy.runner.tradeSizeUsd, 2).toFixed(2)} per trade.`;

    snapshot.strategy.marketConditions = {
      ...snapshot.strategy.marketConditions,
      "Watched Symbols": snapshot.strategy.runner.watchedSymbols.join(", "),
      "Confidence Threshold": `${(snapshot.strategy.runner.confidenceThreshold * 100).toFixed(0)}%`,
      "Trade Size Per Signal": `$${round(snapshot.strategy.runner.tradeSizeUsd, 2).toFixed(2)}`,
      "Max Auto Trades / Day": String(snapshot.strategy.runner.maxTradesPerDay),
      "Cooldown After Losses": String(snapshot.strategy.runner.cooldownAfterLosses),
      "Runner Cadence": `${snapshot.strategy.runner.cadenceSeconds}s`,
      "Account Mode": `${accountModeLabel(snapshot.settings.exchange.accountMode)} ${snapshot.settings.exchange.accountMode === "futures" ? `${snapshot.settings.exchange.futuresLeverage}x` : "1x"}`
    };

    await this.appendLog(workspaceId, "execution", "success", "Strategy runner settings saved.", {
      cadenceSeconds: snapshot.strategy.runner.cadenceSeconds,
      confidenceThreshold: snapshot.strategy.runner.confidenceThreshold,
      tradeSizeUsd: snapshot.strategy.runner.tradeSizeUsd,
      maxTradesPerDay: snapshot.strategy.runner.maxTradesPerDay,
      cooldownAfterLosses: snapshot.strategy.runner.cooldownAfterLosses,
      watchedSymbols: snapshot.strategy.runner.watchedSymbols
    });

    return this.persistAndHydrate(workspaceId, snapshot);
  };

  toggleStrategy = async (paused: boolean) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot();
    snapshot.strategy.paused = paused;
    snapshot.strategy.readiness = paused ? "Paused" : "Ready";
    snapshot.risk.circuitBreaker = paused ? "Paused" : "Normal";
    await this.appendLog(workspaceId, "execution", "info", paused ? "Strategy paused." : "Strategy resumed.", { paused });
    return this.persistAndHydrate(workspaceId, snapshot);
  };

  resetPaperWorkspace = async (balance = 10_000, currency = "USD") => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(false);
    this.ensureRunnerState(snapshot);

    const mode = snapshot.settings.exchange.accountMode ?? "spot";
    const leverage = accountLeverage(mode, Math.min(snapshot.settings.exchange.futuresLeverage, snapshot.risk.policy.futuresMaxLeverage));
    const result = await krakenCliService.initPaper(balance, currency, mode);
    const now = new Date().toISOString();

    await prisma.$transaction([
      prisma.tradeExecution.deleteMany({ where: { workspaceId } }),
      prisma.position.deleteMany({ where: { workspaceId } }),
      prisma.validationArtifact.deleteMany({ where: { workspaceId } }),
      prisma.logEntry.deleteMany({ where: { workspaceId } }),
      prisma.jobRun.deleteMany({ where: { workspaceId } }),
      prisma.tradeIntent.deleteMany({ where: { workspaceId } })
    ]);

    this.priceMemory.clear();

    snapshot.settings.exchange.paperTrading = true;
    snapshot.settings.exchange.connected = true;
    snapshot.generatedAt = now;
    snapshot.trades = [];
    snapshot.positions = [];
    snapshot.dashboard.equityCurve = [];
    snapshot.dashboard.metricCards = [
      { label: "Total Equity", value: balance, format: "currency", suffix: `Paper Trading ${accountModeLabel(mode)}` },
      { label: "Available Balance", value: balance, format: "currency", suffix: `${accountModeLabel(mode)} ${currency} cash` },
      { label: "Daily PnL", value: 0, format: "currency", suffix: "Today" },
      { label: "Weekly PnL", value: 0, format: "currency", suffix: "7d" }
    ];
    snapshot.dashboard.attributionByMode = {
      spot: emptyModeAttribution("spot"),
      futures: emptyModeAttribution("futures")
    };
    snapshot.dashboard.winRate = 0;
    snapshot.dashboard.maxDrawdown = 0;
    snapshot.dashboard.sharpeRatio = 0;
    snapshot.dashboard.totalTrades = 0;
    snapshot.dashboard.openPositionsPreview = [];
    snapshot.dashboard.recentTradesPreview = [];
    snapshot.dashboard.recentSignals = [];
    snapshot.dashboard.recentArtifacts = [];

    snapshot.paper = {
      ...snapshot.paper,
      status: "healthy",
      accountMode: mode,
      leverage,
      source: typeof result === "object" && result && (result as Record<string, unknown>).mode === "mock" ? "mock" : "kraken-cli",
      initialized: true,
      syncedAt: now,
      equity: balance,
      balance,
      unrealizedPnL: 0,
      realizedPnL: 0,
      tradeCount: 0,
      openPositionCount: 0,
      lastError: null,
      recentOrders: []
    };

    snapshot.strategy.currentMode = "AI Awaiting Candidates";
    snapshot.strategy.marketRegime = "AI Warmup";
    snapshot.strategy.readiness = snapshot.strategy.paused ? "Paused" : "Ready";
    snapshot.strategy.signalsToday = 0;
    snapshot.strategy.executedToday = 0;
    snapshot.strategy.blockedToday = 0;
    snapshot.strategy.performance = [];
    snapshot.strategy.eventHistory = [];
    snapshot.strategy.aiCommentary = [];
    snapshot.strategy.runner = {
      ...snapshot.strategy.runner,
      enabled: false,
      status: "Stopped",
      lastRunAt: null,
      lastSignalAt: null,
      lastTradeAt: null,
      latestSummary: `Paper workspace reset to ${currency} ${balance}. History cleared and runner stopped.`
    };
    snapshot.strategy.ai = {
      ...snapshot.strategy.ai,
      status: snapshot.strategy.ai.enabled ? snapshot.strategy.ai.status : "Fallback",
      lastDecisionAt: null,
      recommendedAction: "HOLD",
      recommendedSymbol: null,
      confidence: null,
      rationale: "Fresh reset complete. AI is waiting for the next bounded market scan.",
      riskNote: "Risk checks remain the final authority.",
      error: null,
      selectedCandidateId: null,
      strategyModule: null,
      executionBias: null,
      sizeMultiplier: null,
      stopLossPercent: null,
      takeProfitPercent: null,
      rankingSummary: null,
      futuresThrottle: null,
      futuresDefense: null,
      positionExitEngine: null,
      portfolioAllocation: null
    };

    snapshot.risk.checks = [];
    snapshot.risk.blockedTradeIntents = [];
    snapshot.risk.events = [];
    snapshot.risk.blockedTrades24h = 0;
    snapshot.risk.circuitBreaker = snapshot.strategy.paused ? "Paused" : "Normal";

    snapshot.validation.artifacts = [];
    snapshot.validation.totalProofs = 0;
    snapshot.validation.publishRate = 0;
    snapshot.validation.trustScore = 0;
    snapshot.validation.activeSince = now;
    snapshot.validation.reputationSummary = [
      { label: "Success rate", value: "0.0%" },
      { label: "Trading yield (30d)", value: "$0.00" },
      { label: "Validation average", value: "0.0%" },
      { label: "Endpoint uptime", value: "No runs yet" }
    ];

    snapshot.logs = {
      execution: [],
      signal: [],
      risk: [],
      publish: [],
      error: [],
      jobs: []
    };

    snapshot.system.environment = "Paper Trading";
    snapshot.system.notifications = 0;
    snapshot.system.healthLabel = snapshot.settings.exchange.connected ? "All systems operational" : "Exchange disconnected";
    snapshot.system.connections.exchangeConnected = snapshot.settings.exchange.connected;
    snapshot.system.connections.websocketConnected = snapshot.settings.exchange.connected;
    snapshot.system.connections.chainSynced = Boolean(snapshot.settings.blockchain.rpcEndpoint);
    snapshot.system.connections.publishWorkerHealthy = true;
    snapshot.system.connections.queueHealthy = true;
    snapshot.system.connections.lastSyncLabel = formatSyncLabel(new Date(now));
    snapshot.system.connections.rateLimitAvailable = `${accountModeLabel(mode)} paper engine ${mode === "futures" ? `${leverage}x` : "1x"}`;

    await this.persistSnapshot(workspaceId, snapshot);
    const nextSnapshot = await this.getSnapshot(false);
    return {
      ok: true,
      message: `Paper workspace reset to ${currency} ${balance}. Trades, PnL history, proofs, logs, and notifications were cleared.`,
      snapshot: nextSnapshot,
      result
    };
  };

  initPaperAccount = async (balance = 10_000, currency = "USD") => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot(false);
    const mode = snapshot.settings.exchange.accountMode ?? "spot";
    const leverage = accountLeverage(mode, Math.min(snapshot.settings.exchange.futuresLeverage, snapshot.risk.policy.futuresMaxLeverage));
    const result = await krakenCliService.initPaper(balance, currency, mode);

    snapshot.settings.exchange.paperTrading = true;
    snapshot.settings.exchange.connected = true;
    snapshot.system.environment = "Paper Trading";
    snapshot.paper = {
      ...snapshot.paper,
      status: "healthy",
      accountMode: mode,
      leverage,
      source: typeof result === "object" && result && (result as Record<string, unknown>).mode === "mock" ? "mock" : "kraken-cli",
      initialized: true,
      syncedAt: new Date().toISOString(),
      equity: balance,
      balance,
      unrealizedPnL: 0,
      realizedPnL: 0,
      tradeCount: snapshot.trades.length,
      openPositionCount: snapshot.positions.length,
      lastError: null,
      recentOrders: snapshot.paper.recentOrders.slice(0, 8)
    };

    setMetricValue(snapshot, "Total Equity", balance, `Paper Trading ${accountModeLabel(mode)}`);
    setMetricValue(snapshot, "Available Balance", balance, `${accountModeLabel(mode)} ${currency} cash`);

    await this.recordJob(workspaceId, `kraken.${mode}.paper.init`, "Completed", 100, { balance, currency, mode, leverage, result });
    await this.appendLog(workspaceId, "execution", "success", `Kraken ${mode} paper account initialized.`, { balance, currency, mode, leverage, result });

    await this.persistSnapshot(workspaceId, snapshot);
    const syncResult = await this.reconcilePaperState(workspaceId, snapshot, { persist: true, logErrors: true });
    const nextSnapshot = await this.getSnapshot(false);
    return {
      ok: true,
      message: syncResult.error ? `Paper account initialized with ${currency} ${balance}. Sync warning: ${syncResult.error}` : `Paper account initialized with ${currency} ${balance}.`,
      snapshot: nextSnapshot,
      result
    };
  };

  private evaluateRisk(snapshot: ProofTraderSnapshot, request: ExecuteTradeRequest, estimatedPrice: number) {
    const policy = snapshot.risk.policy;
    const accountMode = request.accountMode ?? snapshot.settings.exchange.accountMode ?? "spot";
    const leverage = accountMode === "futures"
      ? Math.min(Math.max(Math.round(request.leverage ?? snapshot.settings.exchange.futuresLeverage ?? 2), 1), policy.futuresMaxLeverage)
      : 1;
    const marketValue = round(request.size * estimatedPrice, 2);
    const availableBalanceCard = snapshot.dashboard.metricCards.find((card) => card.label === "Available Balance");
    const availableBalance = Math.max(snapshot.paper.balance, availableBalanceCard?.value ?? 0, 0);
    const collateralRequired = round(accountMode === "futures" ? marketValue / Math.max(leverage, 1) : marketValue, 2);
    const liquidationPrice = request.liquidationPrice ?? calculateLiquidationPrice(estimatedPrice, request.side, leverage, accountMode);
    const liquidationDistancePercent = request.liquidationDistancePercent ?? calculateLiquidationDistancePercent(estimatedPrice, liquidationPrice);
    const stopDistancePercent = typeof request.stopLoss === "number"
      ? round((Math.abs(estimatedPrice - request.stopLoss) / estimatedPrice) * 100, 2)
      : null;
    const futuresOpenNotional = snapshot.positions
      .filter((position) => position.accountMode === "futures")
      .reduce((sum, position) => sum + position.currentPrice * position.size, 0);

    if (snapshot.strategy.paused) {
      return { ok: false, reason: "Strategy is paused.", riskScore: 0.95 };
    }

    if (!policy.whitelistedMarkets.includes(request.symbol)) {
      return { ok: false, reason: "Symbol not whitelisted by risk policy.", riskScore: 0.91 };
    }

    if (snapshot.positions.length >= policy.maxConcurrentPositions) {
      return { ok: false, reason: "Max concurrent positions reached.", riskScore: 0.87 };
    }

    if (this.hasCorrelatedExposure(snapshot, request.symbol, request.side)) {
      return { ok: false, reason: "Correlated exposure cap reached for this symbol bucket.", riskScore: 0.88 };
    }

    if (accountMode === "futures") {
      if (leverage > policy.futuresMaxLeverage) {
        return { ok: false, reason: `Futures leverage exceeds the ${policy.futuresMaxLeverage}x cap.`, riskScore: 0.94 };
      }
      if (marketValue > policy.futuresMaxPositionNotionalUsd) {
        return { ok: false, reason: `Futures notional exceeds the ${policy.futuresMaxPositionNotionalUsd} USD cap.`, riskScore: 0.9 };
      }
      if (futuresOpenNotional + marketValue > policy.futuresMaxOpenNotionalUsd) {
        return { ok: false, reason: `Open futures exposure would exceed the ${policy.futuresMaxOpenNotionalUsd} USD cap.`, riskScore: 0.91 };
      }
      if (Math.abs(Math.min(snapshot.dashboard.metricCards.find((card) => card.label === "Daily PnL")?.value ?? 0, 0)) >= policy.futuresMaxDailyLossUsd) {
        return { ok: false, reason: "Futures daily loss limit already reached.", riskScore: 0.93 };
      }
      if (currentDrawdownPercent(snapshot) >= policy.futuresMaxDrawdownPercent) {
        return { ok: false, reason: `Current drawdown is above the futures limit of ${policy.futuresMaxDrawdownPercent}%.`, riskScore: 0.92 };
      }
      if (collateralRequired > availableBalance * 0.85) {
        return { ok: false, reason: "Insufficient free balance for futures collateral.", riskScore: 0.9 };
      }
      if ((liquidationDistancePercent ?? 0) < policy.futuresMinLiquidationDistancePercent) {
        return { ok: false, reason: `Liquidation buffer ${(liquidationDistancePercent ?? 0).toFixed(2)}% is below the ${policy.futuresMinLiquidationDistancePercent}% futures minimum.`, riskScore: 0.94 };
      }
      if (stopDistancePercent != null && liquidationDistancePercent != null && stopDistancePercent > liquidationDistancePercent * 0.7) {
        return { ok: false, reason: "Futures stop is too close to the liquidation zone for a professional entry.", riskScore: 0.93 };
      }
      return {
        ok: true,
        reason: `Passed futures checks. ${leverage}x leverage, ${collateralRequired.toFixed(2)} USD collateral, ${(liquidationDistancePercent ?? 0).toFixed(2)}% liquidation buffer.`,
        riskScore: round(clamp(0.28 + Math.max(leverage - 1, 0) * 0.04, 0.28, 0.52), 2)
      };
    }

    if (marketValue > policy.maxPositionSizeUsd) {
      return { ok: false, reason: `Position size exceeds limit of ${policy.maxPositionSizeUsd}.`, riskScore: 0.89 };
    }

    if (marketValue > availableBalance) {
      return { ok: false, reason: "Insufficient spot balance for this trade size.", riskScore: 0.9 };
    }

    const dailyPnlCard = snapshot.dashboard.metricCards.find((card) => card.label === "Daily PnL");
    if (dailyPnlCard && Math.abs(Math.min(dailyPnlCard.value, 0)) >= policy.maxDailyLossUsd) {
      return { ok: false, reason: "Daily loss limit already reached.", riskScore: 0.93 };
    }

    return { ok: true, reason: "Passed all configured spot checks.", riskScore: 0.31 };
  }

  executeTrade = async (request: ExecuteTradeRequest) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot();

    const symbol = request.symbol.trim();
    if (!snapshot.settings.exchange.connected) {
      return { ok: false, message: "Exchange connection is disabled in settings.", snapshot };
    }
    if (!symbol) {
      return { ok: false, message: "Symbol is required.", snapshot };
    }
    if (!Number.isFinite(request.size) || request.size <= 0) {
      return { ok: false, message: "Trade size must be greater than zero.", snapshot };
    }
    if (request.orderType === "limit" && (!Number.isFinite(request.limitPrice) || (request.limitPrice ?? 0) <= 0)) {
      return { ok: false, message: "Limit orders require a valid limit price.", snapshot };
    }
    if (typeof request.stopLoss === "number" && (!Number.isFinite(request.stopLoss) || request.stopLoss <= 0)) {
      return { ok: false, message: "Stop loss must be a positive number.", snapshot };
    }
    if (typeof request.takeProfit === "number" && (!Number.isFinite(request.takeProfit) || request.takeProfit <= 0)) {
      return { ok: false, message: "Take profit must be a positive number.", snapshot };
    }

    const normalizedRequest = { ...request, symbol };
    const ticker = await krakenCliService.ticker(normalizedRequest.symbol);
    const marketPrice = normalizedRequest.limitPrice ?? krakenCliService.extractTickerPrice(ticker, normalizedRequest.symbol) ?? 0;
    if (!marketPrice || Number.isNaN(marketPrice)) {
      throw new Error(`Could not determine a price for ${normalizedRequest.symbol}.`);
    }

    const accountMode = normalizedRequest.accountMode ?? snapshot.settings.exchange.accountMode ?? "spot";
    const leverage = accountMode === "futures"
      ? Math.min(Math.max(Math.round(normalizedRequest.leverage ?? snapshot.settings.exchange.futuresLeverage ?? 2), 1), snapshot.risk.policy.futuresMaxLeverage)
      : 1;
    const executionPrice = normalizedRequest.limitPrice ?? marketPrice;
    const notional = round(normalizedRequest.size * executionPrice, 2);
    const fees = round(notional * FEE_RATE, 4);
    const collateral = round(accountMode === "futures" ? notional / Math.max(leverage, 1) : notional, 2);
    const liquidationPrice = normalizedRequest.liquidationPrice ?? calculateLiquidationPrice(executionPrice, normalizedRequest.side, leverage, accountMode);
    const liquidationDistancePercent = normalizedRequest.liquidationDistancePercent ?? calculateLiquidationDistancePercent(executionPrice, liquidationPrice);

    const intentId = generateId("INT");
    const risk = this.evaluateRisk(snapshot, {
      ...normalizedRequest,
      accountMode,
      leverage,
      liquidationPrice,
      liquidationDistancePercent
    }, marketPrice);
    const strategyLabel = `${normalizedRequest.strategy ?? snapshot.strategy.selectedStrategy} / ${accountModeLabel(accountMode)}${accountMode === "futures" ? ` ${leverage}x` : ""}`;

    await prisma.tradeIntent.create({
      data: {
        id: intentId,
        workspaceId,
        symbol: normalizedRequest.symbol,
        side: normalizedRequest.side,
        size: normalizedRequest.size,
        orderType: normalizedRequest.orderType ?? "market",
        limitPrice: normalizedRequest.limitPrice,
        stopLoss: normalizedRequest.stopLoss,
        takeProfit: normalizedRequest.takeProfit,
        status: risk.ok ? "ACCEPTED" : "BLOCKED",
        blockReason: risk.ok ? null : risk.reason,
        riskScore: risk.riskScore,
        signalSummary: normalizedRequest.signalSummary ?? "No external signal summary provided.",
        riskSummary: risk.reason,
        strategy: strategyLabel,
        payload: toJson({
          ...normalizedRequest,
          accountMode,
          leverage,
          liquidationPrice,
          liquidationDistancePercent
        }) as never,
        decidedAt: new Date()
      }
    });

    if (!risk.ok) {
      await this.appendLog(workspaceId, "risk", "warning", `Trade blocked for ${normalizedRequest.symbol}.`, {
        reason: risk.reason,
        request: {
          ...normalizedRequest,
          accountMode,
          leverage,
          liquidationPrice,
          liquidationDistancePercent
        }
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: false, message: risk.reason, snapshot: nextSnapshot };
    }

    const submission = await krakenCliService.submitPaperOrder({
      symbol: normalizedRequest.symbol,
      side: normalizedRequest.side,
      size: normalizedRequest.size,
      orderType: normalizedRequest.orderType ?? "market",
      limitPrice: normalizedRequest.limitPrice,
      mode: accountMode,
      leverage
    });

    const tradeId = generateId("TRD");
    const artifactId = generateId("VAL");
    const positionId = generateId("POS");
    const payload = buildValidationRequestPayload(tradeId, {
      symbol: normalizedRequest.symbol,
      side: normalizedRequest.side,
      size: normalizedRequest.size,
      executionPrice,
      strategy: normalizedRequest.strategy ?? snapshot.strategy.selectedStrategy,
      accountMode,
      leverage
    });

    const exchangeOrderId = krakenCliService.extractOrderId(submission) ?? generateId("KRAKEN");

    await prisma.tradeExecution.create({
      data: {
        id: tradeId,
        workspaceId,
        intentId,
        exchangeOrderId,
        symbol: normalizedRequest.symbol,
        side: normalizedRequest.side,
        size: normalizedRequest.size,
        entryPrice: executionPrice,
        stopLoss: normalizedRequest.stopLoss,
        takeProfit: normalizedRequest.takeProfit,
        status: "Open",
        openedAt: new Date(),
        realizedPnL: 0,
        unrealizedPnL: 0,
        fees,
        strategy: strategyLabel,
        signalSummary: normalizedRequest.signalSummary ?? "No external signal summary provided.",
        riskSummary: risk.reason,
        artifactId,
        rawResponse: toJson(submission) as never
      }
    });

    const unrealizedPnL = 0;
    const stopLoss = normalizedRequest.stopLoss ?? round(executionPrice * (normalizedRequest.side === "LONG" ? 0.985 : 1.015), 2);
    const takeProfit = normalizedRequest.takeProfit ?? round(executionPrice * (normalizedRequest.side === "LONG" ? 1.03 : 0.97), 2);

    await prisma.position.create({
      data: {
        id: positionId,
        workspaceId,
        linkedTradeId: tradeId,
        symbol: normalizedRequest.symbol,
        side: normalizedRequest.side,
        size: normalizedRequest.size,
        entryPrice: executionPrice,
        currentPrice: executionPrice,
        stopLoss,
        takeProfit,
        unrealizedPnL,
        unrealizedPnLPercent: 0,
        collateral,
        leverage,
        liquidationPrice,
        openedAt: new Date(),
        riskScore: risk.riskScore ?? 0.3
      }
    });

    await prisma.validationArtifact.create({
      data: {
        id: artifactId,
        workspaceId,
        tradeId,
        type: "Trade Intent",
        intentHash: payload.requestHash,
        signatureStatus: "Verified",
        checkpointStatus: "Confirmed",
        onchainReference: null,
        validatorStatus: "Pending",
        riskCheckId: null,
        payload: toJson({ requestURI: payload.requestURI, requestHash: payload.requestHash }) as never,
        createdAt: new Date()
      }
    });

    await prisma.tradeIntent.update({
      where: { id: intentId },
      data: {
        status: "SUBMITTED",
        response: toJson(submission) as never
      }
    });

    const availableBalanceCard = snapshot.dashboard.metricCards.find((card) => card.label === "Available Balance");
    if (availableBalanceCard) {
      const balanceDebit = accountMode === "futures" ? collateral + fees : notional + fees;
      setMetricValue(snapshot, "Available Balance", round(availableBalanceCard.value - balanceDebit, 2));
    }

    await this.recordJob(workspaceId, `kraken.${accountMode}.paper.trade`, "Completed", 100, {
      tradeId,
      symbol: normalizedRequest.symbol,
      side: normalizedRequest.side,
      size: normalizedRequest.size,
      exchangeOrderId,
      accountMode,
      leverage,
      collateral,
      liquidationPrice,
      liquidationDistancePercent
    });
    await this.appendLog(workspaceId, "execution", "success", `Paper ${accountMode} ${normalizedRequest.side.toLowerCase()} submitted for ${normalizedRequest.symbol}.`, {
      tradeId,
      exchangeOrderId,
      size: normalizedRequest.size,
      price: executionPrice,
      accountMode,
      leverage,
      collateral,
      liquidationPrice,
      liquidationDistancePercent
    });
    await this.appendLog(workspaceId, "publish", "info", `Validation artifact queued for ${tradeId}.`, {
      artifactId,
      requestHash: payload.requestHash
    });

    const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
    return { ok: true, message: `Paper ${accountMode} ${normalizedRequest.side.toLowerCase()} submitted for ${normalizedRequest.symbol}.`, snapshot: nextSnapshot, result: submission, tradeId, positionId };
  };

  private async applyPositionAdjustment(
    workspaceId: string,
    snapshot: ProofTraderSnapshot,
    position: Awaited<ReturnType<typeof prisma.position.findUnique>> & { workspaceId: string },
    input: PositionAdjustmentInput
  ) {
    const positionMode = inferPositionAccountMode(position);
    const positionLeverage = accountLeverage(positionMode, Math.max(position.leverage ?? 1, 1));
    const requestedReduceFraction = clamp(input.reduceFraction ?? 0.5, 0.05, 0.95);
    const reduceSize = input.action === "reduce" ? round(position.size * requestedReduceFraction, 6) : position.size;
    const treatAsClose = input.action === "close" || round(position.size - reduceSize, 6) <= 0;
    const submitSize = treatAsClose ? position.size : reduceSize;
    const submitSide = position.side === "LONG" ? "SHORT" : "LONG";
    const ticker = await krakenCliService.ticker(position.symbol);
    const currentPrice = krakenCliService.extractTickerPrice(ticker, position.symbol) ?? position.currentPrice;
    const submission = await krakenCliService.submitPaperOrder({
      symbol: position.symbol,
      side: submitSide,
      size: submitSize,
      orderType: "market",
      mode: positionMode,
      leverage: positionLeverage
    });

    const realizedPnL = round((currentPrice - position.entryPrice) * submitSize * directionMultiplier(position.side), 2);
    const fees = round(currentPrice * submitSize * FEE_RATE, 4);
    const releasedCollateral = positionMode === "futures" ? round(position.collateral * (submitSize / Math.max(position.size, 0.000001)), 2) : 0;
    const nextSize = round(Math.max(position.size - submitSize, 0), 6);
    const nextCollateral = positionMode === "futures" ? round(Math.max(position.collateral - releasedCollateral, 0), 2) : 0;
    const nextUnrealized = round((currentPrice - position.entryPrice) * nextSize * directionMultiplier(position.side), 2);
    const nextPercent = nextCollateral === 0 ? 0 : round((nextUnrealized / nextCollateral) * 100, 2);
    const nextLiquidationPrice = nextSize > 0 ? calculateLiquidationPrice(position.entryPrice, position.side, positionLeverage, positionMode) : null;
    const tradeId = generateId("TRD");
    const artifactId = generateId("VAL");
    const payload = buildValidationRequestPayload(tradeId, {
      action: treatAsClose ? "close-position" : "reduce-position",
      positionId: position.id,
      closePrice: currentPrice,
      size: submitSize,
      symbol: position.symbol,
      accountMode: positionMode,
      leverage: positionLeverage,
      releasedCollateral
    });

    await prisma.tradeExecution.create({
      data: {
        id: tradeId,
        workspaceId,
        exchangeOrderId: krakenCliService.extractOrderId(submission) ?? generateId("KRAKEN"),
        symbol: position.symbol,
        side: position.side,
        size: submitSize,
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        status: "Closed",
        openedAt: position.openedAt,
        closedAt: new Date(),
        realizedPnL,
        unrealizedPnL: 0,
        fees,
        strategy: input.strategyLabel ?? `${snapshot.strategy.selectedStrategy} / ${accountModeLabel(positionMode)}${positionMode === "futures" ? ` ${positionLeverage}x` : ""}`,
        signalSummary: input.signalSummary,
        riskSummary: input.riskSummary,
        artifactId,
        rawResponse: toJson(submission) as never
      }
    });

    await prisma.validationArtifact.create({
      data: {
        id: artifactId,
        workspaceId,
        tradeId,
        type: "Trade Execution",
        intentHash: payload.requestHash,
        signatureStatus: "Verified",
        checkpointStatus: "Confirmed",
        onchainReference: null,
        validatorStatus: "Pending",
        riskCheckId: null,
        payload: toJson({ requestURI: payload.requestURI, requestHash: payload.requestHash }) as never,
        createdAt: new Date()
      }
    });

    if (treatAsClose) {
      await prisma.position.delete({ where: { id: position.id } });
    } else {
      await prisma.position.update({
        where: { id: position.id },
        data: {
          size: nextSize,
          currentPrice,
          unrealizedPnL: nextUnrealized,
          unrealizedPnLPercent: nextPercent,
          collateral: nextCollateral,
          leverage: positionLeverage,
          liquidationPrice: nextLiquidationPrice
        }
      });
    }

    const balanceCredit = positionMode === "futures" ? releasedCollateral + realizedPnL - fees : (currentPrice * submitSize) - fees;
    snapshot.paper.balance = round(snapshot.paper.balance + balanceCredit, 2);
    snapshot.paper.realizedPnL = round(snapshot.paper.realizedPnL + realizedPnL, 2);
    snapshot.paper.openPositionCount = treatAsClose ? Math.max(snapshot.paper.openPositionCount - 1, 0) : snapshot.paper.openPositionCount;
    setMetricValue(snapshot, "Available Balance", snapshot.paper.balance, `${accountModeLabel(snapshot.settings.exchange.accountMode ?? "spot")} paper cash`);

    await this.recordJob(workspaceId, input.jobType, "Completed", 100, {
      positionId: position.id,
      tradeId,
      symbol: position.symbol,
      accountMode: positionMode,
      leverage: positionLeverage,
      releasedCollateral,
      realizedPnL,
      fees,
      reducedBy: treatAsClose ? null : submitSize,
      action: treatAsClose ? "close" : "reduce",
      ...input.meta
    });
    await this.appendLog(workspaceId, input.logStream, input.logLevel, input.logMessage, {
      positionId: position.id,
      tradeId,
      symbol: position.symbol,
      accountMode: positionMode,
      leverage: positionLeverage,
      releasedCollateral,
      realizedPnL,
      fees,
      size: submitSize,
      closePrice: currentPrice,
      result: submission,
      ...input.meta
    });

    return {
      ok: true,
      message: input.successMessage,
      tradeId,
      action: treatAsClose ? "close" as const : "reduce" as const,
      realizedPnL,
      releasedCollateral,
      currentPrice
    };
  }

  handlePositionAction = async (positionId: string, body: PositionActionRequest) => {
    const workspaceId = await this.ensureWorkspace();
    const snapshot = await this.getSnapshot();
    const position = await prisma.position.findUnique({ where: { id: positionId } });

    if (!position || position.workspaceId !== workspaceId) {
      return { ok: false, message: `Position ${positionId} not found.`, snapshot: await this.getSnapshot() };
    }

    if (body.action === "pause") {
      const nextSnapshot = await this.toggleStrategy(true);
      return { ok: true, message: "Strategy paused from the positions screen.", snapshot: nextSnapshot };
    }

    const positionMode = inferPositionAccountMode(position);
    const positionLeverage = accountLeverage(positionMode, Math.max(position.leverage ?? 1, 1));
    const strategyLabel = `${snapshot.strategy.selectedStrategy} / ${accountModeLabel(positionMode)}${positionMode === "futures" ? ` ${positionLeverage}x` : ""}`;

    if (body.action === "reduce") {
      const reduction = await this.applyPositionAdjustment(workspaceId, snapshot, position as typeof position & { workspaceId: string }, {
        action: "reduce",
        reduceFraction: 0.5,
        signalSummary: "Manual 50% reduce from positions screen",
        riskSummary: `Operator requested scale-out on ${accountModeLabel(positionMode).toLowerCase()} exposure`,
        strategyLabel,
        jobType: `kraken.${positionMode}.paper.reduce`,
        logStream: "execution",
        logLevel: "success",
        logMessage: `Reduced ${position.symbol} exposure by 50%.`,
        successMessage: `Reduced ${position.symbol} exposure by 50%.`,
        meta: {
          reducedByPercent: 50,
          accountMode: positionMode,
          leverage: positionLeverage
        }
      });
      const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
      return { ok: true, message: reduction.message, snapshot: nextSnapshot };
    }

    const closeResult = await this.applyPositionAdjustment(workspaceId, snapshot, position as typeof position & { workspaceId: string }, {
      action: "close",
      signalSummary: "Manual close from positions screen",
      riskSummary: `Operator requested full close on ${accountModeLabel(positionMode).toLowerCase()} exposure`,
      strategyLabel,
      jobType: `kraken.${positionMode}.paper.close`,
      logStream: "execution",
      logLevel: "success",
      logMessage: `Close request accepted for ${position.symbol}.`,
      successMessage: `Close request accepted for ${position.symbol}.`,
      meta: {
        accountMode: positionMode,
        leverage: positionLeverage
      }
    });

    const nextSnapshot = await this.persistAndHydrate(workspaceId, snapshot);
    return { ok: true, message: closeResult.message, snapshot: nextSnapshot };
  };
}

export const stateStore = new StateStore();
