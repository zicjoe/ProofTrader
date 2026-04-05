import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select";
import { useAppData } from "../providers/app-data-provider";
import { formatCurrency } from "../lib/format";
import { toast } from "sonner";
import { Circle, Loader2, SendHorizonal } from "lucide-react";

type TradeTicketDraft = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: string;
  orderType: "market" | "limit";
  limitPrice: string;
  stopLoss: string;
  takeProfit: string;
  signalSummary: string;
};

const DEFAULT_DRAFT: TradeTicketDraft = {
  symbol: "",
  side: "LONG",
  size: "",
  orderType: "market",
  limitPrice: "",
  stopLoss: "",
  takeProfit: "",
  signalSummary: ""
};

export function TradeTicketCard() {
  const { snapshot, submitTrade } = useAppData();
  const [draft, setDraft] = useState<TradeTicketDraft>(DEFAULT_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  const allowedSymbols = snapshot?.strategy.allowedSymbols ?? [];
  const exchangeConnected = snapshot?.system.connections.exchangeConnected ?? false;
  const paperTrading = snapshot?.settings.exchange.paperTrading ?? false;
  const selectedStrategy = snapshot?.strategy.selectedStrategy ?? "Trend Following";
  const accountMode = snapshot?.settings.exchange.accountMode ?? "spot";
  const leverageLabel = accountMode === "futures" ? `${snapshot?.settings.exchange.futuresLeverage ?? 2}x` : "1x";
  const strategyPaused = snapshot?.strategy.paused ?? false;
  const openSlots = snapshot ? Math.max(snapshot.risk.policy.maxConcurrentPositions - snapshot.positions.length, 0) : 0;

  useEffect(() => {
    if (!snapshot) return;
    setDraft((current) => ({
      ...current,
      symbol: current.symbol || snapshot.strategy.allowedSymbols[0] || "BTC/USD"
    }));
  }, [snapshot]);

  const estimatedReferencePrice = useMemo(() => {
    if (!snapshot) return null;

    const fromPosition = snapshot.positions.find((position) => position.symbol === draft.symbol && position.accountMode === accountMode)?.currentPrice;
    if (typeof fromPosition === "number") return fromPosition;

    const fromTrade = snapshot.trades.find((trade) => trade.symbol === draft.symbol && trade.accountMode === accountMode)?.entryPrice;
    if (typeof fromTrade === "number") return fromTrade;

    return null;
  }, [snapshot, draft.symbol, accountMode]);

  const numericSize = Number(draft.size);
  const numericLimitPrice = Number(draft.limitPrice);
  const referencePrice = draft.orderType === "limit" && Number.isFinite(numericLimitPrice) && numericLimitPrice > 0
    ? numericLimitPrice
    : estimatedReferencePrice;
  const estimatedNotional = Number.isFinite(numericSize) && numericSize > 0 && typeof referencePrice === "number"
    ? numericSize * referencePrice
    : null;

  const update = <K extends keyof TradeTicketDraft>(field: K, value: TradeTicketDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const resetDraft = () => {
    setDraft((current) => ({
      ...DEFAULT_DRAFT,
      symbol: current.symbol || allowedSymbols[0] || "BTC/USD",
      side: "LONG",
      orderType: "market"
    }));
  };

  const handleSubmit = async () => {
    const size = Number(draft.size);
    const limitPrice = draft.limitPrice.trim() ? Number(draft.limitPrice) : undefined;
    const stopLoss = draft.stopLoss.trim() ? Number(draft.stopLoss) : undefined;
    const takeProfit = draft.takeProfit.trim() ? Number(draft.takeProfit) : undefined;

    if (!draft.symbol) {
      toast.error("Choose a symbol first.");
      return;
    }
    if (!Number.isFinite(size) || size <= 0) {
      toast.error("Enter a valid trade size.");
      return;
    }
    if (draft.orderType === "limit" && (!Number.isFinite(limitPrice) || (limitPrice ?? 0) <= 0)) {
      toast.error("Enter a valid limit price.");
      return;
    }
    if (typeof stopLoss === "number" && (!Number.isFinite(stopLoss) || stopLoss <= 0)) {
      toast.error("Stop loss must be a positive number.");
      return;
    }
    if (typeof takeProfit === "number" && (!Number.isFinite(takeProfit) || takeProfit <= 0)) {
      toast.error("Take profit must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const message = await submitTrade({
        symbol: draft.symbol,
        side: draft.side,
        size,
        orderType: draft.orderType,
        limitPrice,
        stopLoss,
        takeProfit,
        signalSummary: draft.signalSummary.trim() || undefined,
        strategy: selectedStrategy,
        accountMode,
        leverage: accountMode === "futures" ? snapshot?.settings.exchange.futuresLeverage ?? 2 : 1
      });
      toast.success(message);
      resetDraft();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trade submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const maxPositionLabel = accountMode === "futures" ? "Futures max position" : "Spot max position";
  const maxPositionValue = accountMode === "futures"
    ? snapshot?.risk.policy.futuresMaxPositionNotionalUsd ?? 0
    : snapshot?.risk.policy.maxPositionSizeUsd ?? 0;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Execution Ticket</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">Submit a real Kraken paper trade from the dashboard.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge className={paperTrading ? "bg-amber-950 text-amber-400 border-amber-800 gap-2" : "bg-blue-950 text-blue-400 border-blue-800 gap-2"}>
              <Circle className={`h-2 w-2 ${paperTrading ? "fill-amber-500 text-amber-500" : "fill-blue-500 text-blue-500"}`} />
              {paperTrading ? `${accountMode === "futures" ? `Futures ${leverageLabel}` : "Spot 1x"} paper` : "Live mode"}
            </Badge>
            <Badge className={exchangeConnected ? "bg-green-950 text-green-400 border-green-800 gap-2" : "bg-red-950 text-red-400 border-red-800 gap-2"}>
              <Circle className={`h-2 w-2 ${exchangeConnected ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"}`} />
              {exchangeConnected ? "Exchange ready" : "Exchange offline"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <Field label="Symbol">
            <Select value={draft.symbol} onValueChange={(value) => update("symbol", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose market" />
              </SelectTrigger>
              <SelectContent>
                {allowedSymbols.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Side">
            <Select value={draft.side} onValueChange={(value) => update("side", value as "LONG" | "SHORT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LONG">Long</SelectItem>
                <SelectItem value="SHORT">Short</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Order type">
            <Select value={draft.orderType} onValueChange={(value) => update("orderType", value as "market" | "limit")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Size">
            <Input type="number" min="0" step="any" value={draft.size} onChange={(event) => update("size", event.target.value)} placeholder="0.10" />
          </Field>

          <Field label="Limit price">
            <Input
              type="number"
              min="0"
              step="any"
              value={draft.limitPrice}
              onChange={(event) => update("limitPrice", event.target.value)}
              placeholder={draft.orderType === "limit" ? "Required for limit orders" : "Optional"}
              disabled={draft.orderType !== "limit"}
            />
          </Field>

          <Field label="Strategy">
            <Input value={selectedStrategy} disabled />
          </Field>

          <Field label="Stop loss">
            <Input type="number" min="0" step="any" value={draft.stopLoss} onChange={(event) => update("stopLoss", event.target.value)} placeholder="Optional" />
          </Field>

          <Field label="Take profit">
            <Input type="number" min="0" step="any" value={draft.takeProfit} onChange={(event) => update("takeProfit", event.target.value)} placeholder="Optional" />
          </Field>
        </div>

        <Field label="Signal summary">
          <Textarea
            rows={4}
            value={draft.signalSummary}
            onChange={(event) => update("signalSummary", event.target.value)}
            placeholder="Why is the agent entering this trade? Add the signal or market context here."
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryBox label={maxPositionLabel} value={formatCurrency(maxPositionValue)} />
          <SummaryBox label="Open slots" value={`${openSlots} remaining`} />
          <SummaryBox
            label="Estimated notional"
            value={estimatedNotional !== null ? formatCurrency(estimatedNotional) : "Market priced by CLI"}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div>
            <div className="text-sm font-medium text-white">Execution guardrails</div>
            <p className="mt-1 text-sm text-zinc-400">
              Ticket runs through risk policy, Kraken execution, database persistence, and proof artifact creation.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetDraft} disabled={submitting}>Reset</Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting || strategyPaused || !exchangeConnected} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              {submitting ? "Submitting" : strategyPaused ? "Strategy paused" : "Submit trade"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300">{label}</Label>
      {children}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
