import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "../components/ui/alert-dialog";
import { Shield, Edit, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import type { RiskPolicy } from "@prooftrader/shared";

export function RiskControlsPage() {
  const { snapshot, loading, error, refresh, saveRiskPolicy, toggleStrategy } = useAppData();
  const [editOpen, setEditOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [draft, setDraft] = useState<RiskPolicy | null>(null);

  const riskChecks = snapshot?.risk.checks ?? [];

  const utilizationAverage = useMemo(() => {
    if (!riskChecks.length) return 0;
    return riskChecks.reduce((sum, check) => sum + check.utilization, 0) / riskChecks.length;
  }, [riskChecks]);

  if (loading && !snapshot) return <PageLoading label="Loading risk controls..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No risk snapshot returned." onRetry={() => void refresh()} />;

  const { risk, strategy } = snapshot;

  const openEdit = () => {
    setDraft(structuredClone(risk.policy));
    setEditOpen(true);
  };

  const updateField = <K extends keyof RiskPolicy>(field: K, value: RiskPolicy[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const savePolicy = async () => {
    if (!draft) return;
    try {
      const message = await saveRiskPolicy(draft);
      toast.success(message);
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save policy.");
    }
  };

  const handlePauseToggle = async () => {
    try {
      const message = await toggleStrategy(!strategy.paused);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle strategy.");
    } finally {
      setPauseDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Risk Controls</h1>
          <p className="text-zinc-400">Policy thresholds, blocked intents, and recent risk events.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={openEdit}><Edit className="h-4 w-4" />Edit Policy</Button>
          <Button variant="outline" className="gap-2" onClick={() => setPauseDialogOpen(true)}>
            {strategy.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {strategy.paused ? "Resume Trading" : "Pause Trading"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-4 md:grid-cols-2">
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Circuit Breaker</div><div className="text-2xl font-bold text-white">{risk.circuitBreaker}</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Blocked 24h</div><div className="text-2xl font-bold text-white">{risk.blockedTrades24h}</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Avg utilization</div><div className="text-2xl font-bold text-white">{utilizationAverage.toFixed(1)}%</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Whitelist</div><div className="text-lg font-bold text-white">{risk.policy.whitelistedMarkets.length} markets</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Current Policy</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PolicyField label="Max daily loss" value={`$${risk.policy.maxDailyLossUsd.toLocaleString()}`} />
            <PolicyField label="Weekly drawdown" value={`${risk.policy.maxWeeklyDrawdownPercent}%`} />
            <PolicyField label="Max position size" value={`$${risk.policy.maxPositionSizeUsd.toLocaleString()}`} />
            <PolicyField label="Concurrent positions" value={String(risk.policy.maxConcurrentPositions)} />
            <PolicyField label="Per trade risk" value={`${risk.policy.perTradeRiskPercent}%`} />
            <PolicyField label="Cooldown after losses" value={`${risk.policy.cooldownAfterLosses} losses`} />
            <PolicyField label="Volatility guardrail" value={`${risk.policy.volatilityGuardrailPercent}%`} />
            <PolicyField label="Spread guardrail" value={`${risk.policy.spreadGuardrailPercent}%`} />
            <PolicyField label="Slippage guardrail" value={`${risk.policy.slippageGuardrailPercent}%`} />
            <PolicyField label="Futures max leverage" value={`${risk.policy.futuresMaxLeverage}x`} />
            <PolicyField label="Futures daily loss" value={`$${risk.policy.futuresMaxDailyLossUsd.toLocaleString()}`} />
            <PolicyField label="Futures max drawdown" value={`${risk.policy.futuresMaxDrawdownPercent}%`} />
            <PolicyField label="Futures max position" value={`$${risk.policy.futuresMaxPositionNotionalUsd.toLocaleString()}`} />
            <PolicyField label="Futures open notional" value={`$${risk.policy.futuresMaxOpenNotionalUsd.toLocaleString()}`} />
            <PolicyField label="Futures liq buffer" value={`${risk.policy.futuresMinLiquidationDistancePercent}%`} />
            <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-sm text-zinc-500">Whitelisted markets</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {risk.policy.whitelistedMarkets.map((market) => (
                  <Badge key={market} variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200">{market}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Recent Risk Events</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {risk.events.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-amber-500" /><span className="font-medium text-white">{event.type}</span></div>
                  <Badge className={event.severity === "High" ? "bg-red-950 text-red-400 border-red-800" : "bg-amber-950 text-amber-400 border-amber-800"}>{event.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-300">{event.message}</p>
                <div className="mt-2 text-xs text-zinc-500">{event.timestamp}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle>Risk Checks</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Check</TableHead><TableHead className="text-zinc-400">Status</TableHead><TableHead className="text-zinc-400">Value</TableHead><TableHead className="text-zinc-400">Limit</TableHead><TableHead className="text-zinc-400">Utilization</TableHead><TableHead className="text-zinc-400">Timestamp</TableHead></TableRow></TableHeader>
            <TableBody>
              {risk.checks.map((check) => (
                <TableRow key={check.id} className="border-zinc-800">
                  <TableCell className="text-white">{check.check}</TableCell>
                  <TableCell><Badge className={riskStatusBadgeClass(check.status)}>{check.status}</Badge></TableCell>
                  <TableCell className="text-zinc-300">{check.value}</TableCell>
                  <TableCell className="text-zinc-300">{check.limit}</TableCell>
                  <TableCell className="text-zinc-300">{check.utilization.toFixed(1)}%</TableCell>
                  <TableCell className="text-zinc-500">{check.timestamp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Blocked Trade Intents</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Symbol</TableHead><TableHead className="text-zinc-400">Side</TableHead><TableHead className="text-zinc-400">Reason</TableHead><TableHead className="text-zinc-400">Timestamp</TableHead></TableRow></TableHeader>
              <TableBody>
                {risk.blockedTradeIntents.map((trade) => (
                  <TableRow key={trade.id} className="border-zinc-800">
                    <TableCell className="text-white">{trade.symbol}</TableCell>
                    <TableCell className="text-zinc-300">{trade.side}</TableCell>
                    <TableCell className="text-zinc-300">{trade.reason}</TableCell>
                    <TableCell className="text-zinc-500">{trade.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Trading State</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-sm text-zinc-500">Readiness</div>
              <div className="mt-2 text-lg font-semibold text-white">{strategy.readiness}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-sm text-zinc-500">Pause state</div>
              <div className="mt-2 text-lg font-semibold text-white">{strategy.paused ? "Paused" : "Running"}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-sm text-zinc-500">Monitored markets</div>
              <div className="mt-2 text-sm text-zinc-300">{strategy.allowedSymbols.join(", ")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Edit risk policy</DialogTitle>
            <DialogDescription className="text-zinc-400">These values map directly to the backend policy object.</DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label="Max daily loss (USD)" value={draft.maxDailyLossUsd} onChange={(value) => updateField("maxDailyLossUsd", value)} />
              <NumberField label="Weekly drawdown (%)" value={draft.maxWeeklyDrawdownPercent} onChange={(value) => updateField("maxWeeklyDrawdownPercent", value)} />
              <NumberField label="Max position size (USD)" value={draft.maxPositionSizeUsd} onChange={(value) => updateField("maxPositionSizeUsd", value)} />
              <NumberField label="Concurrent positions" value={draft.maxConcurrentPositions} onChange={(value) => updateField("maxConcurrentPositions", value)} />
              <NumberField label="Per trade risk (%)" value={draft.perTradeRiskPercent} onChange={(value) => updateField("perTradeRiskPercent", value)} />
              <NumberField label="Cooldown after losses" value={draft.cooldownAfterLosses} onChange={(value) => updateField("cooldownAfterLosses", value)} />
              <NumberField label="Volatility guardrail (%)" value={draft.volatilityGuardrailPercent} onChange={(value) => updateField("volatilityGuardrailPercent", value)} />
              <NumberField label="Spread guardrail (%)" value={draft.spreadGuardrailPercent} onChange={(value) => updateField("spreadGuardrailPercent", value)} />
              <NumberField label="Slippage guardrail (%)" value={draft.slippageGuardrailPercent} onChange={(value) => updateField("slippageGuardrailPercent", value)} />
              <NumberField label="Futures max leverage" value={draft.futuresMaxLeverage} onChange={(value) => updateField("futuresMaxLeverage", value)} />
              <NumberField label="Futures daily loss (USD)" value={draft.futuresMaxDailyLossUsd} onChange={(value) => updateField("futuresMaxDailyLossUsd", value)} />
              <NumberField label="Futures max drawdown (%)" value={draft.futuresMaxDrawdownPercent} onChange={(value) => updateField("futuresMaxDrawdownPercent", value)} />
              <NumberField label="Futures max position (USD)" value={draft.futuresMaxPositionNotionalUsd} onChange={(value) => updateField("futuresMaxPositionNotionalUsd", value)} />
              <NumberField label="Futures open notional (USD)" value={draft.futuresMaxOpenNotionalUsd} onChange={(value) => updateField("futuresMaxOpenNotionalUsd", value)} />
              <NumberField label="Futures min liq buffer (%)" value={draft.futuresMinLiquidationDistancePercent} onChange={(value) => updateField("futuresMinLiquidationDistancePercent", value)} />
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">Whitelisted markets</Label>
                <Input
                  value={draft.whitelistedMarkets.join(", ")}
                  onChange={(e) => updateField("whitelistedMarkets", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void savePolicy()}>Save policy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{strategy.paused ? "Resume trading?" : "Pause trading?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This triggers the backend strategy toggle endpoint and updates the risk circuit breaker status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-900 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handlePauseToggle()}>
              {strategy.paused ? "Resume" : "Pause"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PolicyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-zinc-900 border-zinc-700 text-white"
      />
    </div>
  );
}


function riskStatusBadgeClass(status: string) {
  if (status === "Breached") return "bg-red-950 text-red-400 border-red-800";
  if (status === "Warning" || status === "Cooling Down") return "bg-amber-950 text-amber-400 border-amber-800";
  if (status === "Idle") return "bg-zinc-900 text-zinc-400 border-zinc-700";
  return "bg-green-950 text-green-400 border-green-800";
}
