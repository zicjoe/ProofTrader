import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "../components/ui/sheet";
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
import { Progress } from "../components/ui/progress";
import { TrendingUp, TrendingDown, X, MinusCircle, Pause } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import { formatCurrency } from "../lib/format";

export function PositionsPage() {
  const { snapshot, loading, error, refresh, runPositionAction } = useAppData();
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: "close" | "reduce" | "pause"; positionId: string } | null>(null);

  const positions = snapshot?.positions ?? [];
  const totalExposure = useMemo(() => positions.reduce((sum, position) => sum + position.collateral, 0), [positions]);
  const totalUnrealizedPnL = useMemo(() => positions.reduce((sum, position) => sum + position.unrealizedPnL, 0), [positions]);

  if (loading && !snapshot) return <PageLoading label="Loading positions..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No positions snapshot returned." onRetry={() => void refresh()} />;

  const selectedPosition = positions.find((position) => position.id === selectedPositionId) ?? null;
  const longPositions = positions.filter((position) => position.side === "LONG").length;
  const shortPositions = positions.filter((position) => position.side === "SHORT").length;

  const confirmAction = async () => {
    if (!actionDialog) return;
    try {
      const message = await runPositionAction(actionDialog.positionId, actionDialog.type);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run action.");
    } finally {
      setActionDialog(null);
      setSelectedPositionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Positions</h1>
        <p className="text-zinc-400">Monitor exposure, manage open positions, and trigger safe actions.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-4 md:grid-cols-2">
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Open Positions</div><div className="text-3xl font-bold text-white">{positions.length}</div><div className="text-sm text-zinc-400 mt-2">{longPositions} Long / {shortPositions} Short</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Total Exposure</div><div className="text-3xl font-bold text-white">{formatCurrency(totalExposure)}</div><div className="text-sm text-zinc-400 mt-2">Collateral allocated</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Unrealized PnL</div><div className={`text-3xl font-bold ${totalUnrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(totalUnrealizedPnL)}</div><div className="text-sm text-zinc-400 mt-2">Across all open positions</div></CardContent></Card>
        <Card className="bg-zinc-900 border-zinc-800"><CardContent className="p-6"><div className="text-sm text-zinc-400 mb-2">Concurrent Limit</div><div className="text-3xl font-bold text-white">{snapshot.risk.policy.maxConcurrentPositions}</div><div className="text-sm text-zinc-400 mt-2">Risk policy cap</div></CardContent></Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle>Open Positions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Symbol</TableHead>
                <TableHead className="text-zinc-400">Mode</TableHead>
                <TableHead className="text-zinc-400">Side</TableHead>
                <TableHead className="text-zinc-400 text-right">Entry</TableHead>
                <TableHead className="text-zinc-400 text-right">Current</TableHead>
                <TableHead className="text-zinc-400 text-right">PnL</TableHead>
                <TableHead className="text-zinc-400 text-right">Liq Buffer</TableHead>
                <TableHead className="text-zinc-400">Risk</TableHead>
                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.id} className="border-zinc-800">
                  <TableCell className="cursor-pointer" onClick={() => setSelectedPositionId(position.id)}>
                    <div className="font-medium text-white">{position.symbol}</div>
                    <div className="text-xs text-zinc-500">{position.id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={position.accountMode === "futures" ? "bg-violet-950 text-violet-300 border-violet-800" : "bg-sky-950 text-sky-300 border-sky-800"}>
                      {position.accountMode === "futures" ? `${position.leverage}x Futures` : "Spot"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={position.side === "LONG" ? "bg-green-950 text-green-400 border-green-800" : "bg-red-950 text-red-400 border-red-800"}>
                      {position.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-white">{formatCurrency(position.entryPrice)}</TableCell>
                  <TableCell className="text-right text-white">{formatCurrency(position.currentPrice)}</TableCell>
                  <TableCell className={`text-right ${position.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(position.unrealizedPnL)}</TableCell>
                  <TableCell className="text-right text-zinc-300">{formatLiquidationBuffer(position)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress value={position.riskScore * 100} className="h-2 w-24" />
                      <span className="text-sm text-zinc-300">{Math.round(position.riskScore * 100)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActionDialog({ type: "reduce", positionId: position.id })}><MinusCircle className="mr-2 h-4 w-4" />Reduce</Button>
                      <Button variant="outline" size="sm" onClick={() => setActionDialog({ type: "close", positionId: position.id })}><X className="mr-2 h-4 w-4" />Close</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedPosition)} onOpenChange={(open) => !open && setSelectedPositionId(null)}>
        <SheetContent side="right" className="w-[560px] overflow-y-auto border-zinc-800 bg-zinc-950 text-white">
          {selectedPosition ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedPosition.symbol}</SheetTitle>
                <SheetDescription>{selectedPosition.id} • Opened {selectedPosition.openedAt}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Position Summary</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div><div className="text-zinc-500">Mode</div><div className="mt-1">{selectedPosition.accountMode === "futures" ? `Futures ${selectedPosition.leverage}x` : "Spot"}</div></div>
                    <div><div className="text-zinc-500">Side</div><div className="mt-1">{selectedPosition.side}</div></div>
                    <div><div className="text-zinc-500">Size</div><div className="mt-1">{selectedPosition.size}</div></div>
                    <div><div className="text-zinc-500">Entry price</div><div className="mt-1">{formatCurrency(selectedPosition.entryPrice)}</div></div>
                    <div><div className="text-zinc-500">Current price</div><div className="mt-1">{formatCurrency(selectedPosition.currentPrice)}</div></div>
                    <div><div className="text-zinc-500">Stop loss</div><div className="mt-1">{formatCurrency(selectedPosition.stopLoss)}</div></div>
                    <div><div className="text-zinc-500">Take profit</div><div className="mt-1">{formatCurrency(selectedPosition.takeProfit)}</div></div>
                    <div><div className="text-zinc-500">Collateral</div><div className="mt-1">{formatCurrency(selectedPosition.collateral)}</div></div>
                    <div><div className="text-zinc-500">Leverage</div><div className="mt-1">{selectedPosition.leverage}x</div></div>
                    <div><div className="text-zinc-500">Liquidation price</div><div className="mt-1">{selectedPosition.liquidationPrice ? formatCurrency(selectedPosition.liquidationPrice) : "N/A"}</div></div>
                    <div><div className="text-zinc-500">Liquidation buffer</div><div className="mt-1">{formatLiquidationBuffer(selectedPosition)}</div></div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Risk Score</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={selectedPosition.riskScore * 100} className="h-3" />
                      <span className="text-sm text-zinc-200">{Math.round(selectedPosition.riskScore * 100)}%</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div><div className="text-zinc-500">Unrealized PnL</div><div className={`mt-1 ${selectedPosition.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(selectedPosition.unrealizedPnL)}</div></div>
                      <div><div className="text-zinc-500">PnL %</div><div className="mt-1">{selectedPosition.unrealizedPnLPercent.toFixed(2)}%</div></div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button className="flex-1" variant="outline" onClick={() => setActionDialog({ type: "reduce", positionId: selectedPosition.id })}><MinusCircle className="mr-2 h-4 w-4" />Reduce 50%</Button>
                  <Button className="flex-1" variant="outline" onClick={() => setActionDialog({ type: "pause", positionId: selectedPosition.id })}><Pause className="mr-2 h-4 w-4" />Pause Strategy</Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {actionDialog?.type === "close" && "This will remove the position from the active list in the local sandbox."}
              {actionDialog?.type === "reduce" && "This will cut the selected position size by 50% in the local sandbox."}
              {actionDialog?.type === "pause" && "This will pause the strategy from the positions screen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-900 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmAction()}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function formatLiquidationBuffer(position: { accountMode: "spot" | "futures"; currentPrice: number; liquidationPrice: number | null }) {
  if (position.accountMode !== "futures" || !position.liquidationPrice || position.currentPrice <= 0) return "—";
  const buffer = Math.abs(position.currentPrice - position.liquidationPrice) / position.currentPrice * 100;
  return `${buffer.toFixed(2)}%`;
}
