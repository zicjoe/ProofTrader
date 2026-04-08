import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import dotenv from "dotenv";
import type { ExchangeAccountMode, PaperOrderRecord } from "@prooftrader/shared";

export type OhlcCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
  count: number;
};

export type DepthMetrics = {
  bestBid: number | null;
  bestAsk: number | null;
  spreadPercent: number;
  spreadBps: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  totalDepthUsd: number;
  topLevelLiquidityUsd: number;
  imbalance: number;
  executionQuality: number;
};

dotenv.config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const execFileAsync = promisify(execFile);

export type PaperOrderInput = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  orderType?: "market" | "limit";
  limitPrice?: number;
  mode?: ExchangeAccountMode;
  leverage?: number;
};

export type SpotOrderInput = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  orderType?: "market" | "limit";
  limitPrice?: number;
};

export type NormalizedPaperStatus = {
  source: "kraken-cli" | "mock" | "snapshot";
  equity: number;
  balance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  tradeCount: number;
  initialized: boolean;
  startingBalance: number | null;
  openOrders: number;
  leverage?: number;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function toTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }

  return null;
}

export class KrakenCliService {
  private enabled = String(process.env.KRAKEN_CLI_ENABLED).toLowerCase() === "true";
  private useWsl = String(process.env.KRAKEN_CLI_USE_WSL).toLowerCase() === "true";
  private binary = process.env.KRAKEN_CLI_PATH || "kraken";
  private wslBinary = process.env.KRAKEN_WSL_PATH || "C:\\Windows\\System32\\wsl.exe";
  private runnerUrl = (process.env.KRAKEN_RUNNER_URL || "").trim().replace(/\\/$/, "");
  
  private async run(args: string[]) {
    const command = this.useWsl ? this.wslBinary : this.binary;
    const commandArgs = this.useWsl ? [this.binary, ...args] : args;

    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      env: process.env,
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    });

    const output = (stdout || stderr || "").trim();

    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  }

  normalizeSymbol(symbol: string) {
    return symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }

  private denormalizeSymbol(symbol: string) {
    const raw = symbol.toUpperCase();
    const normalized = this.normalizeSymbol(symbol)
      .replace(/^PF_/, "")
      .replace(/^PI_/, "");
    if (normalized.endsWith("USD") && normalized.length > 3) {
      return `${normalized.slice(0, -3)}/USD`;
    }
    if (raw.startsWith("PF_") || raw.startsWith("PI_")) {
      return normalized;
    }
    return symbol.includes("/") ? symbol : normalized;
  }

  normalizeFuturesSymbol(symbol: string) {
    const normalized = this.normalizeSymbol(symbol).replace(/^PF_/, "");
    if (normalized === "BTCUSD" || normalized === "XBTUSD") return "PF_XBTUSD";
    if (normalized === "ETHUSD") return "PF_ETHUSD";
    if (normalized === "SOLUSD") return "PF_SOLUSD";
    if (normalized.endsWith("USD")) return `PF_${normalized.replace(/^BTC/, "XBT")}`;
    return normalized.startsWith("PF_") ? normalized : `PF_${normalized}`;
  }

  private usingRunner() {
    return this.runnerUrl.length > 0;
  }

  private async requestRunner<T = unknown>(path: string, options?: { method?: "GET" | "POST"; body?: unknown }) {
    if (!this.usingRunner()) {
      throw new Error("Kraken runner URL is not configured.");
    }

    const method = options?.method ?? "GET";
    const response = await fetch(`${this.runnerUrl}${path}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" && options?.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const message = typeof payload === "object" && payload && "message" in (payload as Record<string, unknown>)
        ? String((payload as Record<string, unknown>).message)
        : `Kraken runner returned ${response.status}`;
      throw new Error(message);
    }

    return payload as T;
  }

  private maybeMock(value: unknown) {
    if (!this.enabled) {
      return value;
    }
    return null;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  private round(value: number, places = 4) {
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
  }

  private resolveRestPair(symbol: string) {
    const normalized = this.normalizeSymbol(symbol)
      .replace(/^BTC/, "XBT")
      .replace(/^DOGE/, "DOGE")
      .replace(/^SOL/, "SOL")
      .replace(/^ETH/, "ETH");
    return normalized;
  }

  private async publicGet(path: string, query: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }

    const response = await fetch(`https://api.kraken.com/0/public/${path}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Kraken public ${path} returned ${response.status}`);
    }

    return response.json();
  }

  private firstDefined<T>(...values: Array<T | null | undefined>): T | null {
    for (const value of values) {
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return null;
  }

  private fromPath(root: unknown, path: string): unknown {
    if (!root || typeof root !== "object") {
      return null;
    }

    const segments = path.split(".");
    let current: unknown = root;
    for (const segment of segments) {
      if (!current || typeof current !== "object") {
        return null;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  private firstNumber(root: unknown, paths: string[]): number | null {
    for (const path of paths) {
      const numberValue = toNumber(this.fromPath(root, path));
      if (numberValue !== null) {
        return numberValue;
      }
    }
    return null;
  }

  private firstString(root: unknown, paths: string[]): string | null {
    for (const path of paths) {
      const value = this.fromPath(root, path);
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
    return null;
  }

  private firstArray(root: unknown, paths: string[]): unknown[] {
    for (const path of paths) {
      const value = this.fromPath(root, path);
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  }

  async status() {
    if (this.usingRunner()) {
      return this.requestRunner("/health");
    }
    const mock = this.maybeMock({ mode: "mock", connected: true, message: "Kraken CLI mock mode enabled." });
    if (mock) return mock;
    return this.run(["status", "-o", "json"]);
  }

  async ticker(symbol: string) {
    const pair = this.normalizeSymbol(symbol);
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/market/ticker?symbol=${encodeURIComponent(pair)}`);
    }
    const mock = this.maybeMock({ mode: "mock", [pair]: { c: ["65000.00"], a: ["65005.00"], b: ["64995.00"] } });
    if (mock) return mock;
    return this.run(["ticker", pair, "-o", "json"]);
  }

  async ohlc(symbol: string, interval = 5) {
    const pair = this.resolveRestPair(symbol);
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/market/ohlc?symbol=${encodeURIComponent(pair)}&interval=${interval}`);
    }
    const mock = this.maybeMock({ result: { [pair]: [] } });
    if (mock) return mock;
    return this.publicGet("OHLC", { pair, interval });
  }

  async depth(symbol: string, count = 10) {
    const pair = this.resolveRestPair(symbol);
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/market/depth?symbol=${encodeURIComponent(pair)}&count=${count}`);
    }
    const mock = this.maybeMock({ result: { [pair]: { asks: [], bids: [] } } });
    if (mock) return mock;
    return this.publicGet("Depth", { pair, count });
  }

  async initPaper(balance = 10_000, currency = "USD", mode: ExchangeAccountMode = "spot") {
    if (this.usingRunner()) {
      return this.requestRunner("/v1/paper/init", {
        method: "POST",
        body: { balance, currency, mode }
      });
    }
    const mock = this.maybeMock({ mode: "mock", balance, currency, initialized: true, accountMode: mode });
    if (mock) return mock;

    const initArgs = mode === "futures"
      ? ["futures", "paper", "init", "--balance", String(balance), "-o", "json"]
      : ["paper", "init", "--balance", String(balance), "-o", "json"];
    const statusArgs = mode === "futures"
      ? ["futures", "paper", "status", "-o", "json"]
      : ["paper", "status", "-o", "json"];

    try {
      return await this.run(initArgs);
    } catch (error) {
      const processError = error as { stdout?: string; stderr?: string; message?: string };
      const output = `${processError.stdout ?? ""}
${processError.stderr ?? ""}
${processError.message ?? ""}`.toLowerCase();

      if (output.includes("already initialized")) {
        return this.run(statusArgs);
      }

      throw error;
    }
  }

  async paperStatus(mode: ExchangeAccountMode = "spot") {
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/paper/status?mode=${encodeURIComponent(mode)}`);
    }
    const mock = this.maybeMock({
      mode: "mock",
      accountMode: mode,
      equity: 10_000,
      balance: 10_000,
      availableBalance: 10_000,
      unrealizedPnl: 0,
      realizedPnl: 0,
      tradeCount: 0,
      leverage: mode === "futures" ? 2 : 1
    });
    if (mock) return mock;
    return this.run(mode === "futures" ? ["futures", "paper", "status", "-o", "json"] : ["paper", "status", "-o", "json"]);
  }

  async paperHistory(mode: ExchangeAccountMode = "spot") {
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/paper/history?mode=${encodeURIComponent(mode)}`);
    }
    const mock = this.maybeMock({
      mode: "mock",
      accountMode: mode,
      history: [
        {
          id: `MOCK-HIST-${Date.now()}`,
          orderId: `MOCK-BUY-${Date.now()}`,
          symbol: mode === "futures" ? "PF_XBTUSD" : "BTCUSD",
          side: "buy",
          size: 0.15,
          price: 65000,
          type: "market",
          status: "filled",
          leverage: mode === "futures" ? 2 : 1,
          timestamp: new Date().toISOString()
        }
      ]
    });
    if (mock) return mock;
    return this.run(mode === "futures" ? ["futures", "paper", "history", "-o", "json"] : ["paper", "history", "-o", "json"]);
  }

  async paperBalance(mode: ExchangeAccountMode = "spot") {
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/paper/balance?mode=${encodeURIComponent(mode)}`);
    }
    const mock = this.maybeMock({ mode: "mock", accountMode: mode, balances: { USD: { total: 10_000, available: 10_000, reserved: 0 } } });
    if (mock) return mock;
    return this.run(mode === "futures" ? ["futures", "paper", "balance", "-o", "json"] : ["paper", "balance", "-o", "json"]);
  }

  async paperPositions() {
    if (this.usingRunner()) {
      return this.requestRunner(`/v1/paper/positions`);
    }
    const mock = this.maybeMock({ mode: "mock", positions: [] });
    if (mock) return mock;
    return this.run(["futures", "paper", "positions", "-o", "json"]);
  }

  async paperBuy(symbol: string, size: number, orderType: "market" | "limit" = "market", limitPrice?: number) {
    const pair = this.normalizeSymbol(symbol);
    const mock = this.maybeMock({ mode: "mock", action: "buy", symbol: pair, size, orderType, accepted: true, orderId: `MOCK-BUY-${Date.now()}` });
    if (mock) return mock;
    const args = ["paper", "buy", pair, String(size), "--type", orderType];
    if (orderType === "limit" && typeof limitPrice === "number") {
      args.push("--price", String(limitPrice));
    }
    args.push("-o", "json");
    return this.run(args);
  }

  async paperSell(symbol: string, size: number, orderType: "market" | "limit" = "market", limitPrice?: number) {
    const pair = this.normalizeSymbol(symbol);
    const mock = this.maybeMock({ mode: "mock", action: "sell", symbol: pair, size, orderType, accepted: true, orderId: `MOCK-SELL-${Date.now()}` });
    if (mock) return mock;
    const args = ["paper", "sell", pair, String(size), "--type", orderType];
    if (orderType === "limit" && typeof limitPrice === "number") {
      args.push("--price", String(limitPrice));
    }
    args.push("-o", "json");
    return this.run(args);
  }

  async futuresPaperBuy(symbol: string, size: number, leverage = 2, orderType: "market" | "limit" = "market", limitPrice?: number) {
    const pair = this.normalizeFuturesSymbol(symbol);
    const mock = this.maybeMock({ mode: "mock", action: "buy", symbol: pair, size, leverage, orderType, accepted: true, orderId: `MOCK-FUT-BUY-${Date.now()}` });
    if (mock) return mock;
    const args = ["futures", "paper", "buy", pair, String(size), "--leverage", String(leverage), "--type", orderType];
    if (orderType === "limit" && typeof limitPrice === "number") {
      args.push("--price", String(limitPrice));
    }
    args.push("-o", "json");
    return this.run(args);
  }

  async futuresPaperSell(symbol: string, size: number, leverage = 2, orderType: "market" | "limit" = "market", limitPrice?: number) {
    const pair = this.normalizeFuturesSymbol(symbol);
    const mock = this.maybeMock({ mode: "mock", action: "sell", symbol: pair, size, leverage, orderType, accepted: true, orderId: `MOCK-FUT-SELL-${Date.now()}` });
    if (mock) return mock;
    const args = ["futures", "paper", "sell", pair, String(size), "--leverage", String(leverage), "--type", orderType];
    if (orderType === "limit" && typeof limitPrice === "number") {
      args.push("--price", String(limitPrice));
    }
    args.push("-o", "json");
    return this.run(args);
  }

  async submitPaperSpotOrder(input: SpotOrderInput) {
    if (input.side === "LONG") {
      return this.paperBuy(input.symbol, input.size, input.orderType ?? "market", input.limitPrice);
    }
    return this.paperSell(input.symbol, input.size, input.orderType ?? "market", input.limitPrice);
  }

  async submitPaperOrder(input: PaperOrderInput) {
    if (this.usingRunner()) {
      return this.requestRunner("/v1/paper/order", {
        method: "POST",
        body: input
      });
    }

    const mode = input.mode ?? "spot";
    if (mode === "futures") {
      if (input.side === "LONG") {
        return this.futuresPaperBuy(input.symbol, input.size, input.leverage ?? 2, input.orderType ?? "market", input.limitPrice);
      }
      return this.futuresPaperSell(input.symbol, input.size, input.leverage ?? 2, input.orderType ?? "market", input.limitPrice);
    }

    return this.submitPaperSpotOrder(input);
  }

  extractTickerPrice(payload: unknown, symbol: string): number | null {
    if (!payload || typeof payload !== "object") return null;
    const pair = this.normalizeSymbol(symbol);
    const root = payload as Record<string, unknown>;
    const entry = root[pair] as Record<string, unknown> | undefined;
    if (!entry) return null;

    const close = Array.isArray(entry.c) ? entry.c[0] : null;
    const ask = Array.isArray(entry.a) ? entry.a[0] : null;
    const bid = Array.isArray(entry.b) ? entry.b[0] : null;
    const value = close ?? ask ?? bid;
    const numberValue = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  extractOhlcRows(payload: unknown): OhlcCandle[] {
    if (!payload || typeof payload !== "object") return [];
    const result = (payload as Record<string, unknown>).result;
    if (!result || typeof result !== "object") return [];

    const entries = Object.entries(result as Record<string, unknown>)
      .filter(([key, value]) => key !== "last" && Array.isArray(value));
    const rows = entries[0]?.[1];
    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => {
        if (!Array.isArray(row) || row.length < 7) return null;
        const time = toTimestamp(row[0]);
        const open = toNumber(row[1]);
        const high = toNumber(row[2]);
        const low = toNumber(row[3]);
        const close = toNumber(row[4]);
        const vwap = toNumber(row[5]);
        const volume = toNumber(row[6]);
        const count = toNumber(row[7]) ?? 0;
        if (!time || open == null || high == null || low == null || close == null || vwap == null || volume == null) {
          return null;
        }
        return { time, open, high, low, close, vwap, volume, count };
      })
      .filter((row): row is OhlcCandle => Boolean(row));
  }

  extractDepthMetrics(payload: unknown): DepthMetrics {
    if (!payload || typeof payload !== "object") {
      return { bestBid: null, bestAsk: null, spreadPercent: 0, spreadBps: 0, bidDepthUsd: 0, askDepthUsd: 0, totalDepthUsd: 0, topLevelLiquidityUsd: 0, imbalance: 0, executionQuality: 0 };
    }

    const result = (payload as Record<string, unknown>).result;
    if (!result || typeof result !== "object") {
      return { bestBid: null, bestAsk: null, spreadPercent: 0, spreadBps: 0, bidDepthUsd: 0, askDepthUsd: 0, totalDepthUsd: 0, topLevelLiquidityUsd: 0, imbalance: 0, executionQuality: 0 };
    }

    const entry = Object.values(result as Record<string, unknown>).find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;
    const asks = Array.isArray(entry?.asks) ? entry!.asks : [];
    const bids = Array.isArray(entry?.bids) ? entry!.bids : [];

    const parseSide = (rows: unknown[]) => rows
      .slice(0, 5)
      .map((row) => {
        if (!Array.isArray(row)) return null;
        const price = toNumber(row[0]);
        const volume = toNumber(row[1]);
        if (price == null || volume == null) return null;
        return { price, volume, notional: price * volume };
      })
      .filter((row): row is { price: number; volume: number; notional: number } => Boolean(row));

    const parsedAsks = parseSide(asks);
    const parsedBids = parseSide(bids);
    const bestAsk = parsedAsks[0]?.price ?? null;
    const bestBid = parsedBids[0]?.price ?? null;
    const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : null;
    const spreadPercent = mid ? ((bestAsk! - bestBid!) / mid) * 100 : 0;
    const spreadBps = spreadPercent * 100;
    const askDepthUsd = parsedAsks.reduce((sum, row) => sum + row.notional, 0);
    const bidDepthUsd = parsedBids.reduce((sum, row) => sum + row.notional, 0);
    const totalDepthUsd = askDepthUsd + bidDepthUsd;
    const topLevelLiquidityUsd = (parsedAsks[0]?.notional ?? 0) + (parsedBids[0]?.notional ?? 0);
    const imbalance = totalDepthUsd <= 0 ? 0 : (bidDepthUsd - askDepthUsd) / totalDepthUsd;
    const spreadScore = this.clamp(1 - spreadBps / 20, 0, 1);
    const liquidityScore = this.clamp(totalDepthUsd / 250000, 0, 1);
    const balanceScore = 1 - Math.min(Math.abs(imbalance), 0.65);
    const executionQuality = this.round((spreadScore * 0.45) + (liquidityScore * 0.4) + (balanceScore * 0.15), 3);

    return {
      bestBid,
      bestAsk,
      spreadPercent: this.round(spreadPercent, 4),
      spreadBps: this.round(spreadBps, 2),
      bidDepthUsd: this.round(bidDepthUsd, 2),
      askDepthUsd: this.round(askDepthUsd, 2),
      totalDepthUsd: this.round(totalDepthUsd, 2),
      topLevelLiquidityUsd: this.round(topLevelLiquidityUsd, 2),
      imbalance: this.round(imbalance, 3),
      executionQuality
    };
  }

  extractOrderId(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const root = payload as Record<string, unknown>;
    const candidates = [
      root.orderId,
      root.order_id,
      root.txid,
      root.id,
      typeof root.result === "object" && root.result ? (root.result as Record<string, unknown>).orderId : null,
      typeof root.result === "object" && root.result ? (root.result as Record<string, unknown>).order_id : null,
      typeof root.result === "object" && root.result ? (root.result as Record<string, unknown>).txid : null
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
      if (Array.isArray(candidate) && typeof candidate[0] === "string") {
        return candidate[0];
      }
    }

    return null;
  }

  normalizePaperStatus(payload: unknown): NormalizedPaperStatus {
    const source = typeof payload === "object" && payload && (payload as Record<string, unknown>).mode === "mock" ? "mock" : "kraken-cli";

    const balanceFromBalances = (() => {
      const balances = this.firstDefined(
        this.fromPath(payload, "balances"),
        this.fromPath(payload, "result.balances"),
        this.fromPath(payload, "account.balances"),
        this.fromPath(payload, "paper.balances")
      );

      if (!balances || typeof balances !== "object") {
        return null;
      }

      const usd = (balances as Record<string, unknown>).USD;
      if (usd && typeof usd === "object") {
        return this.firstNumber(usd, ["available", "free", "total"]);
      }

      return this.firstNumber(balances, ["USD.available", "USD.free", "USD.total"]);
    })();

    const balance = this.firstDefined(
      this.firstNumber(payload, [
        "availableBalance",
        "balance",
        "available",
        "cash",
        "account.availableBalance",
        "account.balance",
        "result.availableBalance",
        "result.balance",
        "paper.balance"
      ]),
      balanceFromBalances,
      0
    ) ?? 0;

    const equity = this.firstDefined(
      this.firstNumber(payload, ["equity", "current_value", "portfolioValue", "account.equity", "result.equity", "paper.equity"]),
      balance,
      0
    ) ?? 0;

    const unrealizedPnl = this.firstNumber(payload, ["unrealizedPnl", "unrealizedPnL", "account.unrealizedPnl", "result.unrealizedPnl", "paper.unrealizedPnl"]) ?? 0;
    const realizedPnl = this.firstNumber(payload, ["realizedPnl", "realizedPnL", "account.realizedPnl", "result.realizedPnl", "paper.realizedPnl"]) ?? 0;
    const tradeCount = this.firstNumber(payload, ["tradeCount", "total_trades", "trades", "orders", "result.tradeCount", "paper.tradeCount"]) ?? 0;
    const startingBalance = this.firstNumber(payload, ["starting_balance", "startingBalance", "result.starting_balance", "paper.starting_balance"]);
    const openOrders = this.firstNumber(payload, ["open_orders", "openOrders", "result.open_orders", "paper.open_orders"]) ?? 0;
    const leverage = this.firstNumber(payload, ["leverage", "max_leverage", "result.leverage", "paper.leverage"]) ?? 1;

    return {
      source,
      equity,
      balance,
      unrealizedPnl,
      realizedPnl,
      tradeCount,
      initialized: equity > 0 || balance > 0 || (startingBalance ?? 0) > 0,
      startingBalance,
      openOrders,
      leverage
    };
  }

  normalizePaperHistory(payload: unknown): PaperOrderRecord[] {
    const rows = this.firstArray(payload, ["history", "orders", "trades", "entries", "result.history", "result.orders", "paper.history"]);

    return rows
      .map((row, index) => {
        if (!row || typeof row !== "object") {
          return null;
        }

        const record = row as Record<string, unknown>;
        const sideRaw = String(this.firstDefined(record.side, record.action, record.type, "buy") ?? "buy").toLowerCase();
        const side = sideRaw.includes("sell") || sideRaw.includes("short") ? "SHORT" : "LONG";
        const size = this.firstDefined(
          toNumber(record.size),
          toNumber(record.volume),
          toNumber(record.qty),
          toNumber(record.amount),
          0
        ) ?? 0;
        const price = this.firstDefined(
          toNumber(record.price),
          toNumber(record.avgPrice),
          toNumber(record.avg_price),
          toNumber(record.fillPrice),
          toNumber(record.executedPrice),
          0
        ) ?? 0;
        const orderType = String(this.firstDefined(record.orderType, record.order_type, record.type, "market") ?? "market");
        const id = String(this.firstDefined(record.id, record.orderId, record.order_id, record.txid, `PAPER-${index}`) ?? `PAPER-${index}`);
        const exchangeOrderId = this.firstString(record, ["orderId", "order_id", "txid", "id"]);
        const rawSymbol = String(this.firstDefined(record.symbol, record.pair, record.market, record.instrument, "UNKNOWN") ?? "UNKNOWN");
        const timestamp = toTimestamp(this.firstDefined(record.timestamp, record.time, record.createdAt, record.closedAt, record.updatedAt)) ?? new Date().toISOString();
        const status = String(this.firstDefined(record.status, record.state, record.result, "unknown") ?? "unknown");

        const accountMode = rawSymbol.toUpperCase().includes("PF_") || rawSymbol.toUpperCase().includes("PI_") ? "futures" : "spot";

        return {
          id,
          exchangeOrderId,
          accountMode,
          symbol: this.denormalizeSymbol(rawSymbol),
          side,
          size,
          price,
          orderType,
          status,
          timestamp
        } satisfies PaperOrderRecord;
      })
      .filter((value): value is PaperOrderRecord => value !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const krakenCliService = new KrakenCliService();
