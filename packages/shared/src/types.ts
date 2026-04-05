export type ExchangeAccountMode = "spot" | "futures";

export interface MetricCard {
  label: string;
  value: number;
  format: "currency" | "percent" | "number";
  change?: number;
  suffix?: string;
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface TradeRecord {
  id: string;
  accountMode: ExchangeAccountMode;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  status: "Open" | "Closed" | "Cancelled";
  openedAt: string;
  closedAt: string | null;
  realizedPnL: number;
  unrealizedPnL: number;
  fees: number;
  exchangeOrderId: string;
  strategy: string;
  signalSummary: string;
  riskSummary: string;
  artifactId: string | null;
}

export interface PositionRecord {
  id: string;
  accountMode: ExchangeAccountMode;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  collateral: number;
  leverage: number;
  liquidationPrice: number | null;
  openedAt: string;
  riskScore: number;
}

export interface SignalRecord {
  id: string;
  symbol: string;
  type: string;
  confidence: number;
  action: string;
  time: string;
}

export interface ValidationArtifact {
  id: string;
  type: string;
  intentHash: string;
  signatureStatus: string;
  checkpointStatus: string;
  onchainReference: string | null;
  createdAt: string;
  validatorStatus: string;
  tradeId: string | null;
  riskCheckId: string | null;
}

export interface StrategyEvent {
  id: string;
  type: string;
  symbol: string;
  action: string;
  confidence: number | null;
  outcome: string;
  timestamp: string;
}

export interface RiskCheck {
  id: string;
  check: string;
  status: string;
  value: string;
  limit: string;
  utilization: number;
  timestamp: string;
}

export interface BlockedTradeIntent {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  reason: string;
  riskScore: number | null;
  timestamp: string;
}

export interface RiskEvent {
  id: string;
  type: string;
  severity: "Low" | "Medium" | "High";
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface LogRecord {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  details: Record<string, unknown>;
}

export interface JobStatus {
  id: string;
  type: string;
  status: "Running" | "Completed" | "Failed";
  progress: number;
  startedAt: string;
}

export interface PaperOrderRecord {
  id: string;
  exchangeOrderId: string | null;
  accountMode: ExchangeAccountMode;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  price: number;
  orderType: string;
  status: string;
  timestamp: string;
}

export interface PaperTradingState {
  status: "idle" | "healthy" | "error";
  accountMode: ExchangeAccountMode;
  leverage: number;
  source: "kraken-cli" | "mock" | "snapshot";
  initialized: boolean;
  syncedAt: string | null;
  equity: number;
  balance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  tradeCount: number;
  openPositionCount: number;
  lastError: string | null;
  recentOrders: PaperOrderRecord[];
}

export interface ModeAttributionSnapshot {
  mode: ExchangeAccountMode;
  openPositions: number;
  closedTrades: number;
  winRate: number;
  realizedToday: number;
  realizedWeek: number;
  realizedTotal: number;
  openUnrealized: number;
  capitalDeployedUsd: number;
  openNotionalUsd: number;
  maxDrawdown: number;
  averageLeverage: number;
  equityCurve: EquityPoint[];
}

export interface StrategyFuturesThrottleState {
  mode: ExchangeAccountMode;
  active: boolean;
  posture: "Normal" | "Guarded" | "Tight" | "Defensive";
  score: number;
  blockNewEntries: boolean;
  adjustedConfidenceThreshold: number;
  adjustedMaxTradesPerDay: number;
  adjustedTradeSizeUsd: number;
  leverageCap: number;
  sizeFactor: number;
  summary: string;
  reasons: string[];
  dailyLossUtilization: number;
  drawdownUtilization: number;
  exposureUtilization: number;
  minLiquidationBufferPercent: number | null;
  lossStreak: number;
  winRate: number;
}

export interface StrategyFuturesDefenseState {
  mode: ExchangeAccountMode;
  active: boolean;
  posture: "Normal" | "Guarded" | "Tight" | "Defensive";
  status: "Idle" | "Monitoring" | "Reduce Planned" | "Close Planned" | "Reduced" | "Closed";
  action: "HOLD" | "REDUCE_25" | "REDUCE_50" | "CLOSE";
  summary: string;
  targetPositionId: string | null;
  targetSymbol: string | null;
  reasons: string[];
  liveLiquidationBufferPercent: number | null;
  lossOnCollateralPercent: number | null;
  unrealizedPnL: number | null;
  appliedAt: string | null;
}

export interface StrategyPositionExitEngineState {
  active: boolean;
  status: "Idle" | "Monitoring" | "Exit Planned" | "Exited";
  action: "HOLD" | "STOP_LOSS_CLOSE" | "TAKE_PROFIT_CLOSE" | "MIXED_CLOSE";
  summary: string;
  targetPositionId: string | null;
  targetSymbol: string | null;
  targetAccountMode: ExchangeAccountMode | null;
  reasons: string[];
  stopTriggeredCount: number;
  takeProfitTriggeredCount: number;
  appliedAt: string | null;
  lastExitPrice: number | null;
  lastRealizedPnL: number | null;
}

export interface StrategyPortfolioAllocationState {
  active: boolean;
  status: "Idle" | "Sizing" | "Constrained" | "Blocked";
  mode: ExchangeAccountMode;
  targetSymbol: string | null;
  targetAccountMode: ExchangeAccountMode | null;
  targetBucket: string | null;
  targetSide: "LONG" | "SHORT" | null;
  summary: string;
  reasons: string[];
  recommendedSizeMultiplier: number;
  effectiveTradeSizeUsd: number;
  leverageCap: number | null;
  modeExposureUtilization: number;
  bucketExposureUtilization: number;
  sideExposureUtilization: number;
  portfolioHeat: number;
  openPositionsInMode: number;
  openPositionsInBucket: number;
  appliedAt: string | null;
}

export interface DashboardSnapshot {
  equityCurve: EquityPoint[];
  metricCards: MetricCard[];
  attributionByMode: Record<ExchangeAccountMode, ModeAttributionSnapshot>;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  openPositionsPreview: PositionRecord[];
  recentTradesPreview: TradeRecord[];
  recentSignals: SignalRecord[];
  recentArtifacts: ValidationArtifact[];
}

export interface StrategyRunnerState {
  enabled: boolean;
  status: "Stopped" | "Running" | "Error";
  cadenceSeconds: number;
  confidenceThreshold: number;
  tradeSizeUsd: number;
  maxTradesPerDay: number;
  cooldownAfterLosses: number;
  lastRunAt: string | null;
  lastSignalAt: string | null;
  lastTradeAt: string | null;
  watchedSymbols: string[];
  latestSummary: string;
}

export interface StrategyAiState {
  enabled: boolean;
  provider: "llm" | "heuristic";
  model: string;
  status: "Ready" | "Fallback" | "Error";
  lastDecisionAt: string | null;
  recommendedAction: string;
  recommendedSymbol: string | null;
  confidence: number | null;
  rationale: string;
  riskNote: string;
  error: string | null;
  selectedCandidateId?: string | null;
  strategyModule?: string | null;
  executionBias?: string | null;
  sizeMultiplier?: number | null;
  stopLossPercent?: number | null;
  takeProfitPercent?: number | null;
  rankingSummary?: string | null;
  futuresThrottle?: StrategyFuturesThrottleState | null;
  futuresDefense?: StrategyFuturesDefenseState | null;
  positionExitEngine?: StrategyPositionExitEngineState | null;
  portfolioAllocation?: StrategyPortfolioAllocationState | null;
}

export interface StrategyState {
  selectedStrategy: string;
  currentMode: string;
  marketRegime: string;
  readiness: string;
  signalsToday: number;
  executedToday: number;
  blockedToday: number;
  performance: Array<{ date: string; equity: number; drawdown: number }>;
  eventHistory: StrategyEvent[];
  aiCommentary: Array<{ label: string; tone: string; timestamp: string; body: string }>;
  allowedSymbols: string[];
  monitoredTimeframes: string[];
  entryRules: string[];
  exitRules: string[];
  executionPolicy: string;
  positionSizing: string;
  maxConcurrentPositions: number;
  marketConditions: Record<string, string>;
  paused: boolean;
  runner: StrategyRunnerState;
  ai: StrategyAiState;
}

export interface RiskPolicy {
  maxDailyLossUsd: number;
  maxWeeklyDrawdownPercent: number;
  maxPositionSizeUsd: number;
  maxConcurrentPositions: number;
  perTradeRiskPercent: number;
  cooldownAfterLosses: number;
  volatilityGuardrailPercent: number;
  spreadGuardrailPercent: number;
  slippageGuardrailPercent: number;
  futuresMaxLeverage: number;
  futuresMaxDailyLossUsd: number;
  futuresMaxDrawdownPercent: number;
  futuresMaxPositionNotionalUsd: number;
  futuresMaxOpenNotionalUsd: number;
  futuresMinLiquidationDistancePercent: number;
  whitelistedMarkets: string[];
}

export interface RiskState {
  policy: RiskPolicy;
  checks: RiskCheck[];
  blockedTradeIntents: BlockedTradeIntent[];
  events: RiskEvent[];
  circuitBreaker: "Normal" | "Paused";
  blockedTrades24h: number;
}

export interface ValidationIdentity {
  agentName: string;
  agentWallet: string;
  registrationStatus: string;
  network: string;
  registrationBlock: number;
  validationStandard: string;
  identityRegistry: string;
  agentId: number;
}

export interface ValidationState {
  identity: ValidationIdentity;
  artifacts: ValidationArtifact[];
  trustScore: number;
  publishRate: number;
  totalProofs: number;
  activeSince: string;
  reputationSummary: Array<{ label: string; value: string }>;
}

export interface SystemConnections {
  exchangeConnected: boolean;
  websocketConnected: boolean;
  chainSynced: boolean;
  publishWorkerHealthy: boolean;
  queueHealthy: boolean;
  lastSyncLabel: string;
  rateLimitAvailable: string;
}

export interface ExchangeSettings {
  apiKey: string;
  apiSecret: string;
  connected: boolean;
  paperTrading: boolean;
  accountMode: ExchangeAccountMode;
  futuresLeverage: number;
}

export interface BlockchainSettings {
  network: string;
  rpcEndpoint: string;
  chainId: number;
  identityRegistry: string;
  validationRegistry: string;
  reputationRegistry: string;
}

export interface NotificationSettings {
  slackWebhook: string;
  emailAlerts: boolean;
  pushAlerts: boolean;
  dailyDigest: boolean;
}

export interface IdentitySettings {
  agentName: string;
  agentDescription: string;
  agentWallet: string;
  registrationUri: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface SettingsState {
  exchange: ExchangeSettings;
  blockchain: BlockchainSettings;
  notifications: NotificationSettings;
  identity: IdentitySettings;
  team: TeamMember[];
}

export interface LogsState {
  execution: LogRecord[];
  signal: LogRecord[];
  risk: LogRecord[];
  publish: LogRecord[];
  error: LogRecord[];
  jobs: JobStatus[];
}

export interface SystemState {
  environment: "Production" | "Paper Trading";
  healthLabel: string;
  notifications: number;
  connections: SystemConnections;
}

export interface ProofTraderSnapshot {
  generatedAt: string;
  system: SystemState;
  dashboard: DashboardSnapshot;
  paper: PaperTradingState;
  trades: TradeRecord[];
  positions: PositionRecord[];
  strategy: StrategyState;
  risk: RiskState;
  validation: ValidationState;
  logs: LogsState;
  settings: SettingsState;
}

export interface PositionActionRequest {
  action: "close" | "reduce" | "pause";
}

export interface StrategyToggleRequest {
  paused: boolean;
}

export interface StrategyRunnerConfigRequest {
  cadenceSeconds?: number;
  confidenceThreshold?: number;
  tradeSizeUsd?: number;
  maxTradesPerDay?: number;
  cooldownAfterLosses?: number;
  watchedSymbols?: string[];
}

export interface ApiMessage {
  ok: boolean;
  message: string;
}
