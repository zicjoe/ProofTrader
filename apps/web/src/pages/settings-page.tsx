import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Circle, Eye, EyeOff, RefreshCw, Copy, DatabaseZap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import type { SettingsState } from "@prooftrader/shared";

export function SettingsPage() {
  const { snapshot, loading, error, refresh, saveSettings, testExchange, initPaperAccount, resetPaperWorkspace } = useAppData();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [draft, setDraft] = useState<SettingsState | null>(null);
  const lastSnapshotJsonRef = useRef<string | null>(null);
  const syncDraftFromSnapshotRef = useRef(false);

  useEffect(() => {
    if (!snapshot) return;
    const nextDraft = structuredClone(snapshot.settings);
    const nextJson = JSON.stringify(nextDraft);

    setDraft((current) => {
      if (!current || syncDraftFromSnapshotRef.current) {
        syncDraftFromSnapshotRef.current = false;
        return nextDraft;
      }

      const currentJson = JSON.stringify(current);
      const previousSnapshotJson = lastSnapshotJsonRef.current;
      const isDirtyAgainstPrevious = previousSnapshotJson !== null && currentJson !== previousSnapshotJson;
      const alreadyMatchesNext = currentJson === nextJson;

      if (!isDirtyAgainstPrevious || alreadyMatchesNext) {
        return nextDraft;
      }

      return current;
    });

    lastSnapshotJsonRef.current = nextJson;
  }, [snapshot]);

  const save = async () => {
    if (!draft) return;
    syncDraftFromSnapshotRef.current = true;
    try {
      const message = await saveSettings(draft);
      toast.success(message);
    } catch (err) {
      syncDraftFromSnapshotRef.current = false;
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    }
  };

  const runConnectionTest = async () => {
    try {
      const message = await testExchange();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection test failed.");
    }
  };

  const initPaper = async () => {
    try {
      const message = await initPaperAccount(10_000, "USD");
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Paper account initialization failed.");
    }
  };

  const resetWorkspace = async () => {
    const confirmed = window.confirm(`Reset ${draft?.exchange.accountMode === "futures" ? `Futures ${draft.exchange.futuresLeverage}x` : "Spot"} paper workspace back to USD 10,000 and delete trades, positions, PnL history, proofs, notifications, logs, and runner history?`);
    if (!confirmed) return;

    try {
      const message = await resetPaperWorkspace(10_000, "USD");
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Paper workspace reset failed.");
    }
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  if (loading && !snapshot) return <PageLoading label="Loading settings..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot || !draft) return <PageError message="No settings snapshot returned." onRetry={() => void refresh()} />;

  const connectionLabel = draft.exchange.connected ? "Connected" : "Disconnected";
  const teamSummary = `${draft.team.length} member${draft.team.length === 1 ? "" : "s"}`;
  const leverageCap = snapshot.risk.policy.futuresMaxLeverage;
  const modeLabel = draft.exchange.accountMode === "futures" ? `Futures ${draft.exchange.futuresLeverage}x` : "Spot 1x";
  const settingsDirty = JSON.stringify(draft) !== JSON.stringify(snapshot.settings);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-zinc-400">Configure exchange, trading mode, chain, notifications, identity, and team access.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2" onClick={() => void runConnectionTest()}>
          <RefreshCw className="h-4 w-4" />
          Test Exchange
        </Button>

        <Button variant="outline" className="gap-2" onClick={() => void initPaper()}>
          <DatabaseZap className="h-4 w-4" />
          Initialize {draft.exchange.accountMode === "futures" ? `Futures ${draft.exchange.futuresLeverage}x` : "Spot"} Paper $10,000
        </Button>

        <Button variant="destructive" className="gap-2" onClick={() => void resetWorkspace()}>
          <RotateCcw className="h-4 w-4" />
          Reset Paper Workspace
        </Button>

        <Button onClick={() => void save()} disabled={!settingsDirty}>Save Settings</Button>
      </div>

      <Tabs defaultValue="exchange" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="exchange">Exchange</TabsTrigger>
          <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="exchange">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle>Kraken Connection & Account Mode</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge className={draft.exchange.connected ? "bg-green-950 text-green-400 border-green-800 gap-2" : "bg-red-950 text-red-400 border-red-800 gap-2"}>
                    <Circle className={`w-2 h-2 ${draft.exchange.connected ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"}`} />
                    {connectionLabel}
                  </Badge>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200">{modeLabel}</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-6 xl:grid-cols-2">
              <SecretField
                label="API Key"
                value={draft.exchange.apiKey}
                visible={showApiKey}
                setVisible={setShowApiKey}
                onChange={(value) => setDraft({ ...draft, exchange: { ...draft.exchange, apiKey: value } })}
                onCopy={() => void copy(draft.exchange.apiKey, "API key")}
              />

              <SecretField
                label="API Secret"
                value={draft.exchange.apiSecret}
                visible={showApiSecret}
                setVisible={setShowApiSecret}
                onChange={(value) => setDraft({ ...draft, exchange: { ...draft.exchange, apiSecret: value } })}
                onCopy={() => void copy(draft.exchange.apiSecret, "API secret")}
              />

              <ToggleRow label="Exchange connected" checked={draft.exchange.connected} onCheckedChange={(checked) => setDraft({ ...draft, exchange: { ...draft.exchange, connected: checked } })} />
              <ToggleRow label="Paper trading" checked={draft.exchange.paperTrading} onCheckedChange={(checked) => setDraft({ ...draft, exchange: { ...draft.exchange, paperTrading: checked } })} />

              <EnumField
                label="Account mode"
                value={draft.exchange.accountMode}
                options={[{ value: "spot", label: "Spot" }, { value: "futures", label: "Futures" }]}
                onChange={(value) => setDraft({ ...draft, exchange: { ...draft.exchange, accountMode: value as SettingsState["exchange"]["accountMode"] } })}
              />

              <NumberField
                label="Futures leverage"
                value={draft.exchange.futuresLeverage}
                min={1}
                max={leverageCap}
                disabled={draft.exchange.accountMode !== "futures"}
                onChange={(value) => setDraft({
                  ...draft,
                  exchange: { ...draft.exchange, futuresLeverage: Math.min(Math.max(Math.round(value || 1), 1), leverageCap) }
                })}
              />
              <p className="-mt-2 text-xs text-zinc-500 xl:col-span-2">Backend futures leverage cap: {leverageCap}x from the active risk policy.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blockchain">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle>Blockchain Settings</CardTitle></CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <TextField label="Network" value={draft.blockchain.network} onChange={(value) => setDraft({ ...draft, blockchain: { ...draft.blockchain, network: value } })} />
              <TextField label="RPC Endpoint" value={draft.blockchain.rpcEndpoint} onChange={(value) => setDraft({ ...draft, blockchain: { ...draft.blockchain, rpcEndpoint: value } })} />
              <NumberField label="Chain ID" value={draft.blockchain.chainId} onChange={(value) => setDraft({ ...draft, blockchain: { ...draft.blockchain, chainId: value } })} />
              <TextField label="Identity Registry" value={draft.blockchain.identityRegistry} onChange={(value) => setDraft({ ...draft, blockchain: { ...draft.blockchain, identityRegistry: value } })} />
              <TextField label="Validation Registry" value={draft.blockchain.validationRegistry} onChange={(value) => setDraft({ ...draft, blockchain: { ...draft.blockchain, validationRegistry: value } })} />
              <TextField label="Reputation Registry" value={draft.blockchain.reputationRegistry} onChange={(value) => setDraft({ ...draft, blockchain: { ...draft.blockchain, reputationRegistry: value } })} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <TextField label="Slack Webhook" value={draft.notifications.slackWebhook} onChange={(value) => setDraft({ ...draft, notifications: { ...draft.notifications, slackWebhook: value } })} />
              <ToggleRow label="Email alerts" checked={draft.notifications.emailAlerts} onCheckedChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, emailAlerts: checked } })} />
              <ToggleRow label="Push alerts" checked={draft.notifications.pushAlerts} onCheckedChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, pushAlerts: checked } })} />
              <ToggleRow label="Daily digest" checked={draft.notifications.dailyDigest} onCheckedChange={(checked) => setDraft({ ...draft, notifications: { ...draft.notifications, dailyDigest: checked } })} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identity">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader><CardTitle>Agent Identity</CardTitle></CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <TextField label="Agent name" value={draft.identity.agentName} onChange={(value) => setDraft({ ...draft, identity: { ...draft.identity, agentName: value } })} />
              <TextField label="Agent wallet" value={draft.identity.agentWallet} onChange={(value) => setDraft({ ...draft, identity: { ...draft.identity, agentWallet: value } })} />
              <TextField label="Description" value={draft.identity.agentDescription} onChange={(value) => setDraft({ ...draft, identity: { ...draft.identity, agentDescription: value } })} />
              <TextField label="Registration URI" value={draft.identity.registrationUri} onChange={(value) => setDraft({ ...draft, identity: { ...draft.identity, registrationUri: value } })} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team & Access</CardTitle>
                <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300">{teamSummary}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.team.map((member, index) => (
                <div key={member.id} className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 xl:grid-cols-3">
                  <TextField label="Name" value={member.name} onChange={(value) => { const next = [...draft.team]; next[index] = { ...next[index], name: value }; setDraft({ ...draft, team: next }); }} />
                  <TextField label="Role" value={member.role} onChange={(value) => { const next = [...draft.team]; next[index] = { ...next[index], role: value }; setDraft({ ...draft, team: next }); }} />
                  <TextField label="Email" value={member.email} onChange={(value) => { const next = [...draft.team]; next[index] = { ...next[index], email: value }; setDraft({ ...draft, team: next }); }} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SecretField({ label, value, visible, setVisible, onChange, onCopy }: { label: string; value: string; visible: boolean; setVisible: (visible: boolean) => void; onChange: (value: string) => void; onCopy: () => void; }) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white pr-10" />
          <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onCopy}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, disabled }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <Input type="number" min={min} max={max} disabled={disabled} value={value} onChange={(e) => onChange(Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-white disabled:opacity-50" />
    </div>
  );
}

function EnumField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <Label className="text-zinc-200">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
