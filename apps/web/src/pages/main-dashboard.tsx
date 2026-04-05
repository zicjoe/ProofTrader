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
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  CheckCircle,
  Database,
  RefreshCw,
  Wallet,
  Clock
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import { formatCurrency, formatNumber, formatPercent, truncateHash } from "../lib/format";
import { TradeTicketCard } from "../components/trade-ticket-card";

function MetricIcon(label: string) {
  if (label.toLowerCase().includes("pnl")) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (label.toLowerCase().includes("balance")) {
    return <Activity className="h-4 w-4 text-blue-500" />;
  }
  return <TrendingUp className="h-4 w-4 text-green-500" />;
}

function modeBadgeClass(mode: "spot" | "futures") {
  return mode === "futures"
    ? "border-blue-800 bg-blue-950 text-blue-300"
    : "border-emerald-800 bg-emerald-950 text-emerald-300";
}

function drawdownLabel(value: number) {
  return value === 0 ? "0.0%" : formatPercent(value, 1);
}

export function MainDashboard() {
  const { snapshot, loading, liveSyncing, lastLiveSyncAt, error, refresh, syncPaperAccount } = useAppData();

  if (loading && !snapshot) return <PageLoading />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh({ sync: true })} />;
  if (!snapshot) return <PageError message="No snapshot returned from the API." onRetry={() => void refresh({ sync: true })} />;

  const { dashboard, system, strategy, risk, paper } = snapshot;
  const accountModeLabel = paper.accountMode === "futures" ? `Futures ${paper.leverage}x` : "Spot 1x";
  const attributionCards = [dashboard.attributionByMode.spot, dashboard.attributionByMode.futures];
  const paperStatusClass = paper.status === "healthy"
    ? "bg-green-950 text-green-400 border-green-800"
    : paper.status === "error"
      ? "bg-red-950 text-red-400 border-red-800"
      : "bg-zinc-800 text-zinc-300 border-zinc-700";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400">Real-time overview of trading, risk, paper execution, and proof publishing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={paperStatusClass}>{paper.status === "healthy" ? `Paper Sync Healthy • ${accountModeLabel}` : paper.status === "error" ? `Paper Sync Error • ${accountModeLabel}` : `Paper Sync Idle • ${accountModeLabel}`}</Badge>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            onClick={() => void syncPaperAccount()}
            disabled={liveSyncing || !snapshot.settings.exchange.paperTrading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${liveSyncing ? "animate-spin" : ""}`} />
            {liveSyncing ? "Syncing" : "Sync Paper State"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metricCards.map((card) => (
          <Card key={card.label} className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-zinc-400">{card.label}</CardTitle>
                {MetricIcon(card.label)}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`mb-1 text-3xl font-bold ${card.value >= 0 ? "text-white" : "text-red-400"}`}>
                {card.format === "currency"
                  ? formatCurrency(card.value)
                  : card.format === "percent"
                    ? formatPercent(card.value)
                    : formatNumber(card.value)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {typeof card.change === "number" ? (
                  <span className={card.change >= 0 ? "flex items-center text-green-500" : "flex items-center text-red-500"}>
                    {card.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {formatPercent(card.change)}
                  </span>
                ) : null}
                {card.suffix ? <span className="text-zinc-500">{card.suffix}</span> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900"><CardContent className="p-6"><div className="mb-1 text-sm text-zinc-400">Win Rate</div><div className="text-2xl font-bold text-white">{dashboard.winRate.toFixed(1)}%</div></CardContent></Card>
        <Card className="border-zinc-800 bg-zinc-900"><CardContent className="p-6"><div className="mb-1 text-sm text-zinc-400">Max Drawdown</div><div className="text-2xl font-bold text-red-400">{formatPercent(dashboard.maxDrawdown, 1)}</div></CardContent></Card>
        <Card className="border-zinc-800 bg-zinc-900"><CardContent className="p-6"><div className="mb-1 text-sm text-zinc-400">Sharpe Style Metric</div><div className="text-2xl font-bold text-white">{dashboard.sharpeRatio.toFixed(2)}</div></CardContent></Card>
        <Card className="border-zinc-800 bg-zinc-900"><CardContent className="p-6"><div className="mb-1 text-sm text-zinc-400">Total Trades</div><div className="text-2xl font-bold text-white">{formatNumber(dashboard.totalTrades)}</div></CardContent></Card>
      </div>


      <div className="grid gap-6 xl:grid-cols-2">
        {attributionCards.map((mode) => {
          const chartData = mode.equityCurve.length > 0 ? mode.equityCurve : [{ date: "Now", value: 0 }];
          const exposureLabel = mode.mode === "futures" ? "Open Notional" : "Open Exposure";
          const capitalLabel = mode.mode === "futures" ? "Collateral In Use" : "Capital Deployed";
          return (
            <Card key={mode.mode} className="border-zinc-800 bg-zinc-900">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>{mode.mode === "futures" ? "Futures Attribution" : "Spot Attribution"}</CardTitle>
                    <p className="mt-1 text-sm text-zinc-500">Separate attribution for realized flow, open exposure, and drawdown by account mode.</p>
                  </div>
                  <Badge className={modeBadgeClass(mode.mode)}>
                    {mode.mode === "futures" ? `${mode.averageLeverage.toFixed(2)}x avg leverage` : "1.00x cash"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-28 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), mode.mode === "futures" ? "Futures Equity" : "Spot Equity"]} />
                      <Line type="monotone" dataKey="value" stroke={mode.mode === "futures" ? "#60a5fa" : "#34d399"} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Realized Today</div>
                    <div className={`mt-2 text-xl font-semibold ${mode.realizedToday >= 0 ? "text-white" : "text-red-400"}`}>{formatCurrency(mode.realizedToday)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Open Unrealized</div>
                    <div className={`mt-2 text-xl font-semibold ${mode.openUnrealized >= 0 ? "text-white" : "text-red-400"}`}>{formatCurrency(mode.openUnrealized)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{exposureLabel}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatCurrency(mode.openNotionalUsd)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{capitalLabel}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatCurrency(mode.capitalDeployedUsd)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Max Drawdown</div>
                    <div className={`mt-2 text-xl font-semibold ${mode.maxDrawdown < 0 ? "text-red-400" : "text-white"}`}>{drawdownLabel(mode.maxDrawdown)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Closed Trades</div>
                    <div className="mt-2 text-xl font-semibold text-white">{mode.closedTrades}</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Win Rate</div>
                    <div className="mt-1 font-medium text-white">{mode.winRate.toFixed(1)}%</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Realized 7d</div>
                    <div className={`mt-1 font-medium ${mode.realizedWeek >= 0 ? "text-white" : "text-red-400"}`}>{formatCurrency(mode.realizedWeek)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Open Positions</div>
                    <div className="mt-1 font-medium text-white">{mode.openPositions}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TradeTicketCard />

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.equityCurve}>
                <XAxis dataKey="date" stroke="#71717a" />
                <YAxis stroke="#71717a" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "Equity"]} />
                <Area type="monotone" dataKey="value" stroke="#60a5fa" fill="#1d4ed8" fillOpacity={0.24} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle>Execution Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="text-zinc-400">Market regime</span>
              <Badge className="border-blue-800 bg-blue-950 text-blue-400">{strategy.marketRegime}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="text-zinc-400">Strategy mode</span>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200">{strategy.currentMode}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="text-zinc-400">Risk status</span>
              <Badge className={risk.circuitBreaker === "Normal" ? "border-green-800 bg-green-950 text-green-400" : "border-amber-800 bg-amber-950 text-amber-400"}>
                {risk.circuitBreaker}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Signals Today</div>
                <div className="mt-2 text-2xl font-semibold text-white">{strategy.signalsToday}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Blocked Today</div>
                <div className="mt-2 text-2xl font-semibold text-white">{strategy.blockedToday}</div>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">System Health</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-zinc-300"><span>Exchange connection</span><span>{system.connections.exchangeConnected ? "Healthy" : "Offline"}</span></div>
                <div className="flex items-center justify-between text-zinc-300"><span>Proof publisher</span><span>{system.connections.publishWorkerHealthy ? "Healthy" : "Degraded"}</span></div>
                <div className="flex items-center justify-between text-zinc-300"><span>Queue state</span><span>{system.connections.queueHealthy ? "Healthy" : "Backlog"}</span></div>
                <div className="flex items-center justify-between text-zinc-300"><span>Rate limit</span><span>{system.connections.rateLimitAvailable}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Open Positions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Symbol</TableHead><TableHead className="text-zinc-400">Side</TableHead><TableHead className="text-right text-zinc-400">Current</TableHead><TableHead className="text-right text-zinc-400">PnL</TableHead></TableRow></TableHeader>
              <TableBody>
                {dashboard.openPositionsPreview.map((position) => (
                  <TableRow key={position.id} className="border-zinc-800">
                    <TableCell className="font-medium text-white">{position.symbol}</TableCell>
                    <TableCell>
                      <Badge className={position.side === "LONG" ? "border-green-800 bg-green-950 text-green-400" : "border-red-800 bg-red-950 text-red-400"}>
                        {position.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-zinc-200">{formatCurrency(position.currentPrice)}</TableCell>
                    <TableCell className={`text-right ${position.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(position.unrealizedPnL)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Recent Signals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentSignals.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{signal.symbol}</span>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300">{signal.type}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Confidence {(signal.confidence * 100).toFixed(0)}%</span>
                  <span className={signal.action === "LONG" || signal.action === "SHORT" || signal.action === "Executed" ? "text-green-400" : "text-amber-400"}>{signal.action}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{signal.time}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Recent Proofs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentArtifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-white">{artifact.type}</span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">{artifact.id}</div>
                <div className="mt-1 text-sm text-zinc-300">{truncateHash(artifact.intentHash)}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{artifact.createdAt}</span>
                  <span className="text-green-400">{artifact.validatorStatus}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Recent Trades</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Trade</TableHead><TableHead className="text-zinc-400">Strategy</TableHead><TableHead className="text-right text-zinc-400">Realized PnL</TableHead><TableHead className="text-zinc-400">Closed</TableHead></TableRow></TableHeader>
              <TableBody>
                {dashboard.recentTradesPreview.map((trade) => (
                  <TableRow key={trade.id} className="border-zinc-800">
                    <TableCell>
                      <div className="font-medium text-white">{trade.symbol}</div>
                      <div className="text-xs text-zinc-500">{trade.id}</div>
                    </TableCell>
                    <TableCell className="text-zinc-300">{trade.strategy}</TableCell>
                    <TableCell className={`text-right ${trade.realizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(trade.realizedPnL)}
                    </TableCell>
                    <TableCell className="text-zinc-400">{trade.closedAt ?? "Still open"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader><CardTitle>Ops Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" /><span className="font-medium text-white">Last sync</span></div>
              <p className="mt-2 text-sm text-zinc-400">{system.connections.lastSyncLabel}</p>
              <p className="mt-1 text-xs text-zinc-500">Live refresh: {lastLiveSyncAt ?? "Not synced yet"}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-amber-500" /><span className="font-medium text-white">Risk policy</span></div>
              <p className="mt-2 text-sm text-zinc-400">{strategy.positionSizing}, max {risk.policy.maxConcurrentPositions} concurrent positions.</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-green-500" /><span className="font-medium text-white">Whitelisted markets</span></div>
              <p className="mt-2 text-sm text-zinc-400">{risk.policy.whitelistedMarkets.join(", ")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr]">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle>Paper Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Wallet className="h-4 w-4 text-blue-500" />Equity</div>
                <div className="mt-2 text-2xl font-semibold text-white">{formatCurrency(paper.equity)}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Activity className="h-4 w-4 text-green-500" />Available Balance</div>
                <div className="mt-2 text-2xl font-semibold text-white">{formatCurrency(paper.balance)}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-400">Unrealized PnL</div>
                <div className={`mt-2 text-2xl font-semibold ${paper.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(paper.unrealizedPnL)}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-400">Tracked Orders</div>
                <div className="mt-2 text-2xl font-semibold text-white">{paper.tradeCount}</div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-400">Open Positions</div>
                <div className="mt-2 text-lg font-medium text-white">{paper.openPositionCount}</div>
                <div className="mt-1 text-xs text-zinc-500">Source: {paper.source} • Mode: {accountModeLabel}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Clock className="h-4 w-4 text-zinc-500" />Synced</div>
                <div className="mt-2 text-lg font-medium text-white">{paper.syncedAt ?? "Waiting"}</div>
                {paper.lastError ? <div className="mt-1 text-xs text-red-400">{paper.lastError}</div> : <div className="mt-1 text-xs text-zinc-500">Polling every 15 seconds while paper mode is on.</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle>Recent Paper Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400">Symbol</TableHead>
                  <TableHead className="text-zinc-400">Side</TableHead>
                  <TableHead className="text-right text-zinc-400">Price</TableHead>
                  <TableHead className="text-right text-zinc-400">Size</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paper.recentOrders.length === 0 ? (
                  <TableRow className="border-zinc-800">
                    <TableCell colSpan={5} className="text-center text-zinc-500">No paper order history yet.</TableCell>
                  </TableRow>
                ) : paper.recentOrders.map((order) => (
                  <TableRow key={order.id} className="border-zinc-800">
                    <TableCell>
                      <div className="font-medium text-white">{order.symbol}</div>
                      <div className="text-xs text-zinc-500">{order.exchangeOrderId ?? order.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={order.side === "LONG" ? "border-green-800 bg-green-950 text-green-400" : "border-red-800 bg-red-950 text-red-400"}>{order.side}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-zinc-200">{formatCurrency(order.price)}</TableCell>
                    <TableCell className="text-right text-zinc-300">{formatNumber(order.size)}</TableCell>
                    <TableCell>
                      <div className="text-zinc-300">{order.status}</div>
                      <div className="text-xs text-zinc-500">{order.timestamp}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader><CardTitle>Strategy Performance</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={strategy.performance}>
              <XAxis dataKey="date" stroke="#71717a" />
              <YAxis yAxisId="left" stroke="#71717a" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" stroke="#71717a" tickFormatter={(value) => `${value}%`} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="equity" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="drawdown" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
