import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";

function maskSecret(value: string) {
  if (!value) return "Not configured";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function ApiKeysPage() {
  const { snapshot, loading, error, refresh } = useAppData();

  if (loading && !snapshot) return <PageLoading label="Loading API keys..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No API key snapshot returned." onRetry={() => void refresh()} />;

  const { exchange, blockchain } = snapshot.settings;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">API Keys</h1>
          <p className="text-zinc-400">Connection surfaces currently wired into the frontend and backend snapshot.</p>
        </div>
        <Button asChild>
          <Link to="/app/settings">Manage in Settings</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Exchange Credentials</CardTitle>
              <Badge className={exchange.connected ? "bg-green-950 text-green-300 border-green-800" : "bg-red-950 text-red-300 border-red-800"}>
                {exchange.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoBlock label="API key" value={maskSecret(exchange.apiKey)} mono />
            <InfoBlock label="API secret" value={maskSecret(exchange.apiSecret)} mono />
            <InfoBlock label="Account mode" value={exchange.accountMode === "futures" ? `Futures ${exchange.futuresLeverage}x` : "Spot 1x"} />
            <InfoBlock label="Paper trading" value={exchange.paperTrading ? "Enabled" : "Disabled"} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Chain Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoBlock label="RPC endpoint" value={blockchain.rpcEndpoint} mono />
            <InfoBlock label="Chain ID" value={String(blockchain.chainId)} />
            <InfoBlock label="Identity registry" value={blockchain.identityRegistry} mono />
            <InfoBlock label="Validation registry" value={blockchain.validationRegistry} mono />
            <InfoBlock label="Reputation registry" value={blockchain.reputationRegistry} mono />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 text-sm text-white ${mono ? "font-mono break-all" : ""}`}>{value || "—"}</p>
    </div>
  );
}
