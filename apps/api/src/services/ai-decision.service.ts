type CandidateInput = {
  id: string;
  symbol: string;
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
  price: number;
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
  bucket: string;
  bucketOpenPositions: number;
  bucketOpenNotionalUsd: number;
  sameSideBucketExposure: boolean;
};

type AttributionInput = {
  realizedToday: number;
  realizedWeek: number;
  realizedTotal: number;
  openUnrealized: number;
  openNotionalUsd: number;
  maxDrawdown: number;
  winRate: number;
  openPositions: number;
  averageLeverage: number;
  closedTrades: number;
};

type FuturesThrottleInput = {
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
};

type PortfolioContextInput = {
  modeExposureUtilization: number;
  portfolioHeat: number;
  openPositionsInMode: number;
  dominantSide: "LONG" | "SHORT" | "BALANCED";
  crowdedBuckets: string[];
  summary: string;
};

type AiDecisionInput = {
  trigger: "manual" | "interval" | "bootstrap";
  strategyName: string;
  accountMode: "spot" | "futures";
  watchedSymbols: string[];
  confidenceThreshold: number;
  effectiveConfidenceThreshold: number;
  effectiveMaxTradesPerDay: number;
  candidates: CandidateInput[];
  heuristicsTopCandidate: CandidateInput | null;
  paperBalance: number;
  openPositionCount: number;
  consecutiveLosses: number;
  todaysExecutedTrades: number;
  maxTradesPerDay: number;
  recentWinRate: number;
  currentDrawdownPercent: number;
  modeAttribution: {
    spot: AttributionInput;
    futures: AttributionInput;
  };
  portfolioContext: PortfolioContextInput;
  futuresThrottle: FuturesThrottleInput | null;
};

export type AiDecisionOutput = {
  enabled: boolean;
  provider: "llm" | "heuristic";
  model: string;
  status: "Ready" | "Fallback" | "Error";
  lastDecisionAt: string;
  regime: string;
  mode: string;
  shouldTrade: boolean;
  recommendedAction: "LONG" | "SHORT" | "HOLD";
  recommendedSymbol: string | null;
  confidence: number | null;
  commentary: string;
  rationale: string;
  riskNote: string;
  error: string | null;
  selectedCandidateId: string | null;
  strategyModule: string | null;
  executionBias: string | null;
  sizeMultiplier: number | null;
  stopLossPercent: number | null;
  takeProfitPercent: number | null;
  rankingSummary: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, places = 2) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

function extractContent(payload: ChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

function extractJsonObject(text: string) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI response did not contain a JSON object.");
  }
  return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

function normalizeAction(value: unknown): "LONG" | "SHORT" | "HOLD" {
  const normalized = String(value ?? "HOLD").toUpperCase();
  if (normalized === "LONG" || normalized === "SHORT") return normalized;
  return "HOLD";
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function throttleNote(input: AiDecisionInput) {
  if (input.accountMode !== "futures" || !input.futuresThrottle) {
    return null;
  }
  const throttle = input.futuresThrottle;
  const reasonText = throttle.reasons.slice(0, 3).join(" ");
  const prefix = throttle.blockNewEntries
    ? `Futures throttle is ${throttle.posture.toLowerCase()} and new futures entries are temporarily blocked.`
    : `Futures throttle is ${throttle.posture.toLowerCase()} with ${Math.round(throttle.sizeFactor * 100)}% size and ${throttle.leverageCap}x leverage cap.`;
  return `${prefix} ${throttle.summary}${reasonText ? ` ${reasonText}` : ""}`.trim();
}

class AiDecisionService {
  private forceEnabled = String(process.env.AI_ENABLED ?? "").toLowerCase() === "true";
  private apiKey = process.env.AI_API_KEY ?? "";
  private model = process.env.AI_MODEL ?? "";
  private baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  private get modelEnabled() {
    return (this.forceEnabled || Boolean(this.apiKey)) && Boolean(this.apiKey) && Boolean(this.model);
  }

  async analyze(input: AiDecisionInput): Promise<AiDecisionOutput> {
    const lastDecisionAt = new Date().toISOString();
    if (input.candidates.length === 0) {
      return this.buildFallback(input, lastDecisionAt, null, "No bounded trade candidates were produced by the feature engine.");
    }

    if (!this.modelEnabled) {
      return this.buildFallback(input, lastDecisionAt, null, "AI model is not configured. Add AI_API_KEY and AI_MODEL to enable the live strategy brain.");
    }

    try {
      const isAnthropicCompat = this.baseUrl.includes("anthropic.com");
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "x-api-key": this.apiKey,
          ...(isAnthropicCompat ? { "anthropic-version": "2023-06-01" } : {})
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.15,
          messages: [
            {
              role: "system",
              content:
                "You are the bounded strategy brain for an autonomous crypto paper-trading agent. You must choose only from the provided candidate ids or HOLD. The active model is a hybrid execution system with two modules: trend pullback continuation for cleaner recurring setups and breakout retest confirmation for larger expansion trades. Crypto trades 24/7, so never use session logic. Never approve a breakout candidate without a confirmed retest, and never approve a pullback candidate unless trend structure, reclaim confirmation, and bounded risk all remain intact. Spot mode is long only. Futures mode may choose long or short, but you must respect any futures throttle posture, concentration limits, and hard risk controls. You may tune only bounded execution envelope values and may not invent symbols, directions, or unsafe sizing. Return strict JSON only."
            },
            {
              role: "user",
              content: JSON.stringify({
                instructions: {
                  objective: "Choose the single best candidate or HOLD after reviewing whether the current market better supports a trend pullback continuation or a breakout retest. Evaluate trend structure, pullback quality, reclaim confirmation, compression quality, breakout conviction, retest confirmation, volume expansion, RSI and MACD agreement, ATR-based risk envelope, spread, book quality, drawdown, trade usage, BTC risk-off state, and portfolio concentration. Favor positive expectancy and bounded risk over raw trade count, but allow the pullback module to supply cleaner recurring setups when breakout conditions are absent.",
                  mustBeAiDriven: true,
                  chooseOneCandidateOrHold: true,
                  neverInventCandidateIds: true,
                  neverInventSymbols: true,
                  neverBypassRiskControls: true,
                  confidenceThresholdIsHardGate: true,
                  futuresThrottleIsAuthoritative: true,
                  boundedTuning: {
                    sizeMultiplier: "number between 0.55 and 1.0",
                    stopLossPercent: "number between 0.45 and 6.5",
                    takeProfitPercent: "number between 1.4 and 18.0"
                  },
                  responseShape: {
                    regime: "string",
                    mode: "string",
                    shouldTrade: "boolean",
                    selectedCandidateId: "string|null",
                    recommendedSymbol: "string|null",
                    recommendedAction: "LONG|SHORT|HOLD",
                    confidence: "number between 0 and 1 or null",
                    strategyModule: "string|null",
                    executionBias: "string|null",
                    sizeMultiplier: "number between 0.55 and 1.0 or null",
                    stopLossPercent: "number between 0.6 and 6.5 or null",
                    takeProfitPercent: "number between 3.0 and 18.0 or null",
                    rankingSummary: "string",
                    commentary: "string",
                    rationale: "string",
                    riskNote: "string"
                  }
                },
                input
              })
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`AI API returned ${response.status}`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const parsed = extractJsonObject(extractContent(payload));
      const selectedCandidateId = toOptionalString(parsed.selectedCandidateId);
      const selectedCandidate = selectedCandidateId
        ? input.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null
        : null;
      const recommendedAction = normalizeAction(parsed.recommendedAction ?? selectedCandidate?.action ?? "HOLD");
      const recommendedSymbol = toOptionalString(parsed.recommendedSymbol ?? selectedCandidate?.symbol)?.toUpperCase() ?? null;
      const rawConfidence = toOptionalNumber(parsed.confidence);
      const confidence = rawConfidence == null
        ? selectedCandidate?.confidence ?? null
        : round(clamp(rawConfidence, 0, 1), 2);
      const thresholdGatePassed = confidence == null ? false : confidence >= input.effectiveConfidenceThreshold;
      const selectedMatchesSymbol = !selectedCandidate || !recommendedSymbol || selectedCandidate.symbol.toUpperCase() === recommendedSymbol;
      const selectedMatchesAction = !selectedCandidate || recommendedAction === selectedCandidate.action;
      const spotDirectionAllowed = !(input.accountMode === "spot" && recommendedAction === "SHORT");
      const throttleAllowsTrade = !(input.accountMode === "futures" && input.futuresThrottle?.blockNewEntries);
      const shouldTrade = Boolean(parsed.shouldTrade) && Boolean(selectedCandidate) && recommendedAction !== "HOLD" && thresholdGatePassed && throttleAllowsTrade && spotDirectionAllowed;

      if (shouldTrade && (!selectedCandidate || !selectedMatchesSymbol || !selectedMatchesAction || !spotDirectionAllowed)) {
        return this.buildFallback(
          input,
          lastDecisionAt,
          null,
          "AI returned a candidate selection that did not match the approved candidate set. Falling back to the deterministic strategy engine."
        );
      }

      const throttleSummary = throttleNote(input);
      const riskNote = `${String(parsed.riskNote ?? "Risk controls remain authoritative.")} Effective confidence gate ${Math.round(input.effectiveConfidenceThreshold * 100)}%. Mode trade usage ${input.todaysExecutedTrades}/${input.effectiveMaxTradesPerDay}. Portfolio heat ${Math.round(input.portfolioContext.portfolioHeat * 100)}% with ${Math.round(input.portfolioContext.modeExposureUtilization * 100)}% mode exposure.${throttleSummary ? ` ${throttleSummary}` : ""}`.trim();
      const commentaryBase = String(parsed.commentary ?? "AI reviewed the candidate stack and returned a bounded strategy decision.");
      const commentary = throttleSummary && input.accountMode === "futures"
        ? `${commentaryBase} ${throttleSummary}`
        : commentaryBase;

      return {
        enabled: true,
        provider: "llm",
        model: this.model,
        status: "Ready",
        lastDecisionAt,
        regime: String(parsed.regime ?? selectedCandidate?.regime ?? "Mixed"),
        mode: String(parsed.mode ?? parsed.strategyModule ?? selectedCandidate?.module ?? "Observation"),
        shouldTrade,
        recommendedAction: shouldTrade ? recommendedAction : "HOLD",
        recommendedSymbol: shouldTrade ? (recommendedSymbol ?? selectedCandidate?.symbol ?? null) : null,
        confidence: shouldTrade ? confidence : null,
        commentary,
        rationale: String(parsed.rationale ?? "No rationale returned."),
        riskNote,
        error: null,
        selectedCandidateId: shouldTrade ? selectedCandidate?.id ?? null : null,
        strategyModule: shouldTrade ? (toOptionalString(parsed.strategyModule) ?? selectedCandidate?.module ?? null) : null,
        executionBias: shouldTrade ? (toOptionalString(parsed.executionBias) ?? "Balanced") : null,
        sizeMultiplier: shouldTrade
          ? round(clamp(toOptionalNumber(parsed.sizeMultiplier) ?? selectedCandidate?.sizeMultiplier ?? 1, 0.55, 1.0), 2)
          : null,
        stopLossPercent: shouldTrade
          ? round(clamp(toOptionalNumber(parsed.stopLossPercent) ?? selectedCandidate?.stopLossPercent ?? 1.6, 0.8, 6.5), 2)
          : null,
        takeProfitPercent: shouldTrade
          ? round(clamp(toOptionalNumber(parsed.takeProfitPercent) ?? selectedCandidate?.takeProfitPercent ?? 4.8, 2.4, 18.0), 2)
          : null,
        rankingSummary: String(parsed.rankingSummary ?? this.buildRankingSummary(input.candidates.slice(0, 3)))
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI error.";
      return this.buildFallback(input, lastDecisionAt, message, `AI call failed. Using the deterministic strategy engine instead. ${message}`);
    }
  }

  private buildRankingSummary(candidates: CandidateInput[]) {
    if (candidates.length === 0) return "No ranked candidates.";
    return candidates
      .map((candidate, index) => `${index + 1}. ${candidate.symbol} ${candidate.action} via ${candidate.module} at ${Math.round(candidate.confidence * 100)}% with ${candidate.spreadBps.toFixed(1)}bps spread and ${(candidate.executionQuality * 100).toFixed(0)}% execution quality`)
      .join(" | ");
  }

  private buildFallback(input: AiDecisionInput, lastDecisionAt: string, error: string | null, commentary?: string): AiDecisionOutput {
    const topCandidate = input.heuristicsTopCandidate;
    const throttleAllowsTrade = !(input.accountMode === "futures" && input.futuresThrottle?.blockNewEntries);
    const shouldTrade = Boolean(topCandidate && topCandidate.confidence >= input.effectiveConfidenceThreshold && throttleAllowsTrade && !(input.accountMode === "spot" && topCandidate.action === "SHORT"));
    const throttleSummary = throttleNote(input);
    return {
      enabled: this.modelEnabled,
      provider: "heuristic",
      model: this.model || "not-configured",
      status: error ? "Error" : "Fallback",
      lastDecisionAt,
      regime: topCandidate?.regime ?? "Mixed",
      mode: topCandidate?.module ?? "Observation",
      shouldTrade,
      recommendedAction: shouldTrade ? topCandidate!.action : "HOLD",
      recommendedSymbol: shouldTrade ? topCandidate!.symbol : null,
      confidence: shouldTrade ? round(topCandidate!.confidence, 2) : null,
      commentary:
        commentary ??
        (shouldTrade
          ? `The deterministic hybrid engine favored ${topCandidate!.symbol} ${topCandidate!.action} via ${topCandidate!.module} after reviewing ${input.candidates.length} bounded candidates.${throttleSummary ? ` ${throttleSummary}` : ""}`
          : `The deterministic hybrid engine reviewed ${input.candidates.length} bounded candidates and found no pullback reclaim or breakout retest setup strong enough to trade.${throttleSummary ? ` ${throttleSummary}` : ""}`),
      rationale: shouldTrade
        ? `${topCandidate!.module} ranked highest with ${Math.round(topCandidate!.confidence * 100)}% confidence in a ${topCandidate!.regime} regime, ${topCandidate!.spreadBps.toFixed(1)}bps spread, ${(topCandidate!.executionQuality * 100).toFixed(0)}% execution quality, and a ${topCandidate!.bucket} bucket profile that stayed acceptable for the current portfolio.`
        : throttleAllowsTrade
          ? `No candidate cleared the effective confidence gate of ${Math.round(input.effectiveConfidenceThreshold * 100)}% after the macro regime, volatility, and confirmation filters were applied.`
          : "Futures throttle blocked fresh entries until futures attribution stabilizes.",
      riskNote: shouldTrade
        ? `Mode trade usage: ${input.todaysExecutedTrades}/${input.effectiveMaxTradesPerDay}. Consecutive losses: ${input.consecutiveLosses}. Balance available: $${round(input.paperBalance, 2)}. Drawdown: ${round(input.currentDrawdownPercent, 2)}%.${throttleSummary ? ` ${throttleSummary}` : ""}`
        : `The strategy engine stayed flat because neither the trend-pullback module nor the breakout-retest module cleared the effective threshold of ${Math.round(input.effectiveConfidenceThreshold * 100)}%.${throttleSummary ? ` ${throttleSummary}` : ""}`,
      error,
      selectedCandidateId: shouldTrade ? topCandidate!.id : null,
      strategyModule: shouldTrade ? topCandidate!.module : null,
      executionBias: shouldTrade ? "Balanced" : null,
      sizeMultiplier: shouldTrade ? round(topCandidate!.sizeMultiplier, 2) : null,
      stopLossPercent: shouldTrade ? round(topCandidate!.stopLossPercent, 2) : null,
      takeProfitPercent: shouldTrade ? round(topCandidate!.takeProfitPercent, 2) : null,
      rankingSummary: this.buildRankingSummary(input.candidates.slice(0, 3))
    };
  }
}

export const aiDecisionService = new AiDecisionService();
