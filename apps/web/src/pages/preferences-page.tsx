import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";

export function PreferencesPage() {
  const { snapshot, loading, error, refresh } = useAppData();

  if (loading && !snapshot) return <PageLoading label="Loading preferences..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No preferences snapshot returned." onRetry={() => void refresh()} />;

  const { notifications, exchange } = snapshot.settings;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Preferences</h1>
          <p className="text-zinc-400">Operator defaults and alert preferences pulled from the backend snapshot.</p>
        </div>
        <Button asChild>
          <Link to="/app/settings">Edit in Settings</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PreferenceRow label="Email alerts" enabled={notifications.emailAlerts} />
            <PreferenceRow label="Push alerts" enabled={notifications.pushAlerts} />
            <PreferenceRow label="Daily digest" enabled={notifications.dailyDigest} />
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Slack webhook</p>
              <p className="mt-2 text-sm text-white font-mono break-all">{notifications.slackWebhook || "Not configured"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Workspace Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PreferenceValue label="Environment" value={snapshot.system.environment} />
            <PreferenceValue label="Account mode" value={exchange.accountMode === "futures" ? `Futures ${exchange.futuresLeverage}x` : "Spot 1x"} />
            <PreferenceValue label="System health" value={snapshot.system.healthLabel} />
            <div className="flex flex-wrap gap-2">
              <Badge className={snapshot.strategy.runner.enabled ? "bg-green-950 text-green-300 border-green-800" : "bg-zinc-800 text-zinc-200 border-zinc-700"}>
                {snapshot.strategy.runner.enabled ? "Runner Enabled" : "Runner Disabled"}
              </Badge>
              <Badge className={snapshot.strategy.paused ? "bg-amber-950 text-amber-300 border-amber-800" : "bg-blue-950 text-blue-300 border-blue-800"}>
                {snapshot.strategy.paused ? "Strategy Paused" : "Strategy Active"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreferenceRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <p className="text-sm text-white">{label}</p>
      <Badge className={enabled ? "bg-green-950 text-green-300 border-green-800" : "bg-zinc-800 text-zinc-300 border-zinc-700"}>
        {enabled ? "On" : "Off"}
      </Badge>
    </div>
  );
}

function PreferenceValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-white">{value || "—"}</p>
    </div>
  );
}
