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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Search, Download } from "lucide-react";
import { useAppData } from "../providers/app-data-provider";
import { PageError, PageLoading } from "../components/page-state";
import { downloadCsv } from "../lib/export";
import type { LogRecord } from "@prooftrader/shared";

type LogTab = "execution" | "signal" | "risk" | "publish" | "error";

export function ActivityLogsPage() {
  const { snapshot, loading, error, refresh } = useAppData();
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [activeTab, setActiveTab] = useState<LogTab>("execution");
  const [search, setSearch] = useState("");

  const logs = snapshot?.logs;
  const source = logs ? logs[activeTab] : [];

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return source;
    return source.filter((item) => item.message.toLowerCase().includes(query) || JSON.stringify(item.details).toLowerCase().includes(query));
  }, [source, search]);

  if (loading && !snapshot) return <PageLoading label="Loading logs..." />;
  if (error && !snapshot) return <PageError message={error} onRetry={() => void refresh()} />;
  if (!snapshot) return <PageError message="No logs snapshot returned." onRetry={() => void refresh()} />;

  const exportActiveTab = () => {
    downloadCsv(
      `prooftrader-${activeTab}-logs.csv`,
      filtered.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        level: row.level,
        message: row.message,
        details: JSON.stringify(row.details)
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Activity & Logs</h1>
          <p className="text-zinc-400">Execution, signals, risk, proof publishing, and system errors.</p>
        </div>
        <Button className="gap-2" onClick={exportActiveTab}><Download className="h-4 w-4" />Export Active Tab</Button>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs and payloads" className="pl-10 bg-zinc-800 border-zinc-700 text-white" />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LogTab)} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="signal">Signal</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
          <TabsTrigger value="error">Error</TabsTrigger>
        </TabsList>

        {(["execution", "signal", "risk", "publish", "error"] as LogTab[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="capitalize">{tab} logs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Timestamp</TableHead><TableHead className="text-zinc-400">Level</TableHead><TableHead className="text-zinc-400">Message</TableHead><TableHead className="text-zinc-400">Details</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((log) => (
                      <TableRow key={log.id} className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50" onClick={() => setSelectedLog(log)}>
                        <TableCell className="text-zinc-500">{log.timestamp}</TableCell>
                        <TableCell><LevelBadge level={log.level} /></TableCell>
                        <TableCell className="text-zinc-200">{log.message}</TableCell>
                        <TableCell className="text-zinc-400">{Object.keys(log.details).join(", ") || "No payload"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle>Background Jobs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="border-zinc-800"><TableHead className="text-zinc-400">Job</TableHead><TableHead className="text-zinc-400">Status</TableHead><TableHead className="text-zinc-400">Progress</TableHead><TableHead className="text-zinc-400">Started</TableHead></TableRow></TableHeader>
            <TableBody>
              {snapshot.logs.jobs.map((job) => (
                <TableRow key={job.id} className="border-zinc-800">
                  <TableCell className="text-white">{job.type}</TableCell>
                  <TableCell><Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-200">{job.status}</Badge></TableCell>
                  <TableCell className="text-zinc-300">{job.progress}%</TableCell>
                  <TableCell className="text-zinc-500">{job.startedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-950 text-white">
          <DialogHeader><DialogTitle>{selectedLog?.id}</DialogTitle></DialogHeader>
          {selectedLog ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="text-sm text-zinc-500">Message</div>
                <div className="mt-2 text-zinc-200">{selectedLog.message}</div>
              </div>
              <pre className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-300">
{JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LevelBadge({ level }: { level: LogRecord["level"] }) {
  const cls =
    level === "success"
      ? "bg-green-950 text-green-400 border-green-800"
      : level === "warning"
        ? "bg-amber-950 text-amber-400 border-amber-800"
        : level === "error"
          ? "bg-red-950 text-red-400 border-red-800"
          : "bg-blue-950 text-blue-400 border-blue-800";

  return <Badge className={cls}>{level}</Badge>;
}
