import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";

export function ProfilePage() {
  const { snapshot, loading, error, refresh } = useAppData();

  if (loading && !snapshot) return <PageLoading label="Loading profile..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No profile snapshot returned." onRetry={() => void refresh()} />;

  const { identity, team } = snapshot.settings;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-zinc-400">Workspace identity, agent registration, and operator roster.</p>
        </div>
        <Button asChild>
          <Link to="/app/settings">Edit in Settings</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Agent Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <InfoBlock label="Agent name" value={identity.agentName} />
            <InfoBlock label="Agent wallet" value={identity.agentWallet} mono />
            <InfoBlock label="Registration URI" value={identity.registrationUri} mono />
            <InfoBlock label="Validation standard" value={snapshot.validation.identity.validationStandard} />
            <div className="md:col-span-2">
              <InfoBlock label="Description" value={identity.agentDescription} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Workspace Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200">{snapshot.system.environment}</Badge>
              <Badge className="bg-blue-950 text-blue-300 border-blue-800">{snapshot.validation.identity.registrationStatus}</Badge>
              <Badge className={snapshot.strategy.paused ? "bg-amber-950 text-amber-300 border-amber-800" : "bg-green-950 text-green-300 border-green-800"}>
                {snapshot.strategy.paused ? "Strategy Paused" : "Strategy Live"}
              </Badge>
            </div>
            <InfoBlock label="Agent ID" value={String(snapshot.validation.identity.agentId)} />
            <InfoBlock label="Registry block" value={String(snapshot.validation.identity.registrationBlock)} />
            <InfoBlock label="Network" value={snapshot.validation.identity.network} />
            <InfoBlock label="Identity registry" value={snapshot.validation.identity.identityRegistry} mono />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.length === 0 ? (
            <p className="text-sm text-zinc-500">No team members configured yet.</p>
          ) : (
            team.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{member.name}</p>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </div>
                <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200">{member.role}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
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
