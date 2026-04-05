import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "../components/ui/sheet";
import { Search, Download, ExternalLink } from "lucide-react";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import { formatCurrency } from "../lib/format";
import { downloadCsv } from "../lib/export";

export function TradesPage() {
  const { snapshot, loading, error, refresh } = useAppData();
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  const trades = snapshot?.trades ?? [];

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        trade.id.toLowerCase().includes(query) ||
        trade.symbol.toLowerCase().includes(query) ||
        trade.exchangeOrderId.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || trade.status.toLowerCase() === statusFilter;
      const matchesSide = sideFilter === "all" || trade.side.toLowerCase() === sideFilter;
      const matchesMode = modeFilter === "all" || trade.accountMode === modeFilter;
      return matchesSearch && matchesStatus && matchesSide && matchesMode;
    });
  }, [trades, searchQuery, statusFilter, sideFilter, modeFilter]);

  if (loading && !snapshot) return <PageLoading label="Loading trades..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No trades snapshot returned." onRetry={() => void refresh()} />;

  const selectedTrade = filteredTrades.find((trade) => trade.id === selectedTradeId) ?? trades.find((trade) => trade.id === selectedTradeId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Trades</h1>
          <p className="text-zinc-400">Complete history of execution, outcomes, and linked proofs.</p>
        </div>
        <Button
          className="gap-2"
          onClick={() =>
            downloadCsv(
              "prooftrader-trades.csv",
              filteredTrades.map((trade) => ({
                trade_id: trade.id,
                symbol: trade.symbol,
                account_mode: trade.accountMode,
                side: trade.side,
                status: trade.status,
                strategy: trade.strategy,
                entry_price: trade.entryPrice,
                exit_price: trade.exitPrice,
                realized_pnl: trade.realizedPnL,
                unrealized_pnl: trade.unrealizedPnL,
                fees: trade.fees,
                exchange_order_id: trade.exchangeOrderId,
                opened_at: trade.openedAt,
                closed_at: trade.closedAt
              }))
            )
          }
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[snapshot.dashboard.attributionByMode.spot, snapshot.dashboard.attributionByMode.futures].map((mode) => (
          <Card key={mode.mode} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-zinc-400">{mode.mode === "futures" ? "Futures Attribution" : "Spot Attribution"}</div>
                  <div className={`mt-2 text-2xl font-bold ${mode.realizedToday >= 0 ? "text-white" : "text-red-400"}`}>{formatCurrency(mode.realizedToday)}</div>
                  <div className="mt-1 text-sm text-zinc-500">Realized today • {mode.openPositions} open • {mode.closedTrades} closed</div>
                </div>
                <Badge className={mode.mode === "futures" ? "border-blue-800 bg-blue-950 text-blue-300" : "border-emerald-800 bg-emerald-950 text-emerald-300"}>
                  {mode.mode === "futures" ? `${mode.averageLeverage.toFixed(2)}x avg` : "1.00x cash"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search by trade ID, symbol, or exchange order ID"
                className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sideFilter} onValueChange={setSideFilter}>
              <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700"><SelectValue placeholder="Side" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700"><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="spot">Spot</SelectItem>
                <SelectItem value="futures">Futures</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle>All Trades</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Trade ID</TableHead>
                <TableHead className="text-zinc-400">Symbol</TableHead>
                <TableHead className="text-zinc-400">Mode</TableHead>
                <TableHead className="text-zinc-400">Side</TableHead>
                <TableHead className="text-zinc-400">Strategy</TableHead>
                <TableHead className="text-zinc-400 text-right">Entry</TableHead>
                <TableHead className="text-zinc-400 text-right">Exit</TableHead>
                <TableHead className="text-zinc-400 text-right">PnL</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Opened</TableHead>
                <TableHead className="text-zinc-400"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrades.map((trade) => (
                <TableRow
                  key={trade.id}
                  className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50"
                  onClick={() => setSelectedTradeId(trade.id)}
                >
                  <TableCell className="font-medium text-white">{trade.id}</TableCell>
                  <TableCell className="font-medium text-white">{trade.symbol}</TableCell>
                  <TableCell>
                    <Badge className={trade.accountMode === "futures" ? "border-blue-800 bg-blue-950 text-blue-300" : "border-emerald-800 bg-emerald-950 text-emerald-300"}>
                      {trade.accountMode === "futures" ? "Futures" : "Spot"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={trade.side === "LONG" ? "bg-green-950 text-green-400 border-green-800" : "bg-red-950 text-red-400 border-red-800"}>
                      {trade.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400">{trade.strategy}</TableCell>
                  <TableCell className="text-right text-white">{formatCurrency(trade.entryPrice)}</TableCell>
                  <TableCell className="text-right text-white">{trade.exitPrice ? formatCurrency(trade.exitPrice) : "—"}</TableCell>
                  <TableCell className={`text-right ${trade.realizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatCurrency(trade.realizedPnL)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300">{trade.status}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400">{trade.openedAt}</TableCell>
                  <TableCell className="text-right text-zinc-500">View</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedTrade)} onOpenChange={(open) => !open && setSelectedTradeId(null)}>
        <SheetContent side="right" className="w-[560px] overflow-y-auto border-zinc-800 bg-zinc-950 text-white">
          {selectedTrade ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTrade.id}</SheetTitle>
                <SheetDescription>{selectedTrade.symbol} • {selectedTrade.strategy}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Execution Summary</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div><div className="text-zinc-500">Side</div><div className="mt-1">{selectedTrade.side}</div></div>
                    <div><div className="text-zinc-500">Account mode</div><div className="mt-1">{selectedTrade.accountMode === "futures" ? "Futures" : "Spot"}</div></div>
                    <div><div className="text-zinc-500">Status</div><div className="mt-1">{selectedTrade.status}</div></div>
                    <div><div className="text-zinc-500">Size</div><div className="mt-1">{selectedTrade.size}</div></div>
                    <div><div className="text-zinc-500">Opened</div><div className="mt-1">{selectedTrade.openedAt}</div></div>
                    <div><div className="text-zinc-500">Entry price</div><div className="mt-1">{formatCurrency(selectedTrade.entryPrice)}</div></div>
                    <div><div className="text-zinc-500">Exit price</div><div className="mt-1">{selectedTrade.exitPrice ? formatCurrency(selectedTrade.exitPrice) : "—"}</div></div>
                    <div><div className="text-zinc-500">Stop loss</div><div className="mt-1">{formatCurrency(selectedTrade.stopLoss)}</div></div>
                    <div><div className="text-zinc-500">Take profit</div><div className="mt-1">{formatCurrency(selectedTrade.takeProfit)}</div></div>
                    <div><div className="text-zinc-500">Realized PnL</div><div className={`mt-1 ${selectedTrade.realizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(selectedTrade.realizedPnL)}</div></div>
                    <div><div className="text-zinc-500">Fees</div><div className="mt-1">{formatCurrency(selectedTrade.fees)}</div></div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Signal and Risk</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div><div className="text-zinc-500">Signal summary</div><div className="mt-1 text-zinc-200">{selectedTrade.signalSummary}</div></div>
                    <div><div className="text-zinc-500">Risk summary</div><div className="mt-1 text-zinc-200">{selectedTrade.riskSummary}</div></div>
                    <div><div className="text-zinc-500">Exchange order ID</div><div className="mt-1 font-mono text-zinc-200">{selectedTrade.exchangeOrderId}</div></div>
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                      <span className="text-zinc-400">Linked artifact</span>
                      <div className="flex items-center gap-2">
                        <span>{selectedTrade.artifactId ?? "None"}</span>
                        <ExternalLink className="h-4 w-4 text-zinc-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
