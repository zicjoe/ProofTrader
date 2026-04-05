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
import { Copy, ExternalLink, FileJson } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import { truncateHash } from "../lib/format";
import { api } from "../lib/api";

export function ValidationProofsPage() {
  const { snapshot, loading, error, refresh } = useAppData();
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [registrationJson, setRegistrationJson] = useState<string | null>(null);

  const validation = snapshot?.validation;
  const publishPercent = useMemo(() => `${(validation?.publishRate ?? 0).toFixed(1)}%`, [validation?.publishRate]);

  if (loading && !snapshot) return <PageLoading label="Loading validation proofs..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot || !validation) return <PageError message="No validation snapshot returned." onRetry={() => void refresh()} />;

  const selectedArtifact = validation.artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null;

  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const fetchRegistrationJson = async () => {
    try {
      const result = await api.getRegistration();
      const text = JSON.stringify(result.registration, null, 2);
      setRegistrationJson(text);
      await navigator.clipboard.writeText(text);
      toast.success("Agent registration JSON copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build registration JSON.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Validation Proofs</h1>
        <p className="text-zinc-400">Identity, proof artifacts, and publish status for ERC-8004 style trust records.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Identity Summary</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Summary label="Agent Name" value={validation.identity.agentName} />
            <Summary label="Registration Status" value={validation.identity.registrationStatus} />
            <Summary label="Network" value={validation.identity.network} />
            <Summary label="Agent ID" value={`#${validation.identity.agentId}`} />
            <Summary label="Registration Block" value={String(validation.identity.registrationBlock)} />
            <Summary label="Standard" value={validation.identity.validationStandard} />
            <div className="md:col-span-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-sm text-zinc-500">Agent Wallet</div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="font-mono text-sm text-zinc-200 break-all">{validation.identity.agentWallet}</div>
                <Button variant="outline" size="sm" onClick={() => void copyValue("Wallet", validation.identity.agentWallet)}><Copy className="mr-2 h-4 w-4" />Copy</Button>
              </div>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <Button className="gap-2" onClick={() => void fetchRegistrationJson()}><FileJson className="h-4 w-4" />Build Registration JSON</Button>
              <Button variant="outline" className="gap-2" onClick={() => setRegistrationJson(null)}>Clear Preview</Button>
            </div>
            {registrationJson ? (
              <div className="md:col-span-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-500 mb-2">Latest registration payload</div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">{registrationJson}</pre>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>Reputation Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Summary label="Trust Score" value={`${validation.trustScore.toFixed(1)} / 100`} />
              <Summary label="Publish Rate" value={publishPercent} />
              <Summary label="Total Proofs" value={String(validation.totalProofs)} />
              <Summary label="Active Since" value={validation.activeSince} />
            </div>
            {validation.reputationSummary.map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-500">{item.label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle>Validation Artifact Table</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Artifact</TableHead><TableHead className="text-zinc-400">Signature</TableHead><TableHead className="text-zinc-400">Checkpoint</TableHead><TableHead className="text-zinc-400">Onchain Ref</TableHead><TableHead className="text-zinc-400">Created</TableHead><TableHead className="text-zinc-400">Validator</TableHead></TableRow></TableHeader>
            <TableBody>
              {validation.artifacts.map((artifact) => (
                <TableRow key={artifact.id} className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50" onClick={() => setSelectedArtifactId(artifact.id)}>
                  <TableCell>
                    <div className="font-medium text-white">{artifact.type}</div>
                    <div className="text-xs text-zinc-500">{artifact.id}</div>
                  </TableCell>
                  <TableCell><Badge className="bg-green-950 text-green-400 border-green-800">{artifact.signatureStatus}</Badge></TableCell>
                  <TableCell className="text-zinc-300">{artifact.checkpointStatus}</TableCell>
                  <TableCell className="font-mono text-zinc-300">{artifact.onchainReference ? truncateHash(artifact.onchainReference, 8, 4) : "Pending"}</TableCell>
                  <TableCell className="text-zinc-500">{artifact.createdAt}</TableCell>
                  <TableCell className="text-zinc-300">{artifact.validatorStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedArtifact)} onOpenChange={(open) => !open && setSelectedArtifactId(null)}>
        <SheetContent side="right" className="w-[620px] overflow-y-auto border-zinc-800 bg-zinc-950 text-white">
          {selectedArtifact ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedArtifact.id}</SheetTitle>
                <SheetDescription>{selectedArtifact.type} • {selectedArtifact.createdAt}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Artifact Summary</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 text-sm">
                    <Detail label="Intent hash" value={selectedArtifact.intentHash} copy />
                    <Detail label="Signature status" value={selectedArtifact.signatureStatus} />
                    <Detail label="Checkpoint status" value={selectedArtifact.checkpointStatus} />
                    <Detail label="Validator status" value={selectedArtifact.validatorStatus} />
                    <Detail label="Trade ID" value={selectedArtifact.tradeId ?? "—"} />
                    <Detail label="Risk check ID" value={selectedArtifact.riskCheckId ?? "—"} />
                    <Detail label="Onchain reference" value={selectedArtifact.onchainReference ?? "Pending"} copy={Boolean(selectedArtifact.onchainReference)} />
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Preview Payload</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
{JSON.stringify(selectedArtifact, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                {selectedArtifact.onchainReference ? (
                  <Button variant="outline" className="gap-2" onClick={() => void copyValue("Onchain reference", selectedArtifact.onchainReference!)}>
                    <ExternalLink className="h-4 w-4" />
                    Copy onchain reference
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function Detail({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="break-all font-mono text-sm text-zinc-200">{value}</div>
        {copy ? (
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(value)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        ) : null}
      </div>
    </div>
  );
}
