import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Target,
  Shield,
  CheckCircle,
  Activity,
  Settings,
  Menu,
  Bell,
  User,
  ChevronDown,
  Circle,
  ChevronRight,
  KeyRound,
  SlidersHorizontal,
  TriangleAlert,
  Info
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { useMemo, useState } from "react";
import { useAppData } from "../providers/app-data-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import type { LogRecord, RiskEvent } from "@prooftrader/shared";

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DashboardLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { snapshot } = useAppData();

  const navigation = [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Trades", href: "/app/trades", icon: TrendingUp },
    { name: "Positions", href: "/app/positions", icon: Wallet },
    { name: "Strategy", href: "/app/strategy", icon: Target },
    { name: "Risk Controls", href: "/app/risk-controls", icon: Shield },
    { name: "Validation Proofs", href: "/app/validation-proofs", icon: CheckCircle },
    { name: "Activity & Logs", href: "/app/activity", icon: Activity },
    { name: "Settings", href: "/app/settings", icon: Settings }
  ];

  const isActive = (href: string) => {
    if (href === "/app") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const environmentLabel = snapshot?.system.environment ?? "Loading";
  const notifications = snapshot?.system.notifications ?? 0;
  const systemStatus = snapshot?.system.healthLabel ?? "Connecting...";
  const exchangeConnected = snapshot?.system.connections.exchangeConnected ?? false;
  const chainSynced = snapshot?.system.connections.chainSynced ?? false;
  const publishHealthy = snapshot?.system.connections.publishWorkerHealthy ?? false;

  const notificationItems = useMemo(() => {
    if (!snapshot) return [] as Array<{ id: string; title: string; body: string; tone: "error" | "warning" | "info"; href: string; timestamp: string }>;

    const riskItems = snapshot.risk.events.slice(0, 6).map((event: RiskEvent) => ({
      id: `risk-${event.id}`,
      title: event.type,
      body: event.message,
      tone: event.severity === "High" ? "error" as const : "warning" as const,
      href: "/app/risk-controls",
      timestamp: event.timestamp
    }));

    const errorItems = snapshot.logs.error.slice(0, 6).map((log: LogRecord) => ({
      id: `error-${log.id}`,
      title: "System error",
      body: log.message,
      tone: "error" as const,
      href: "/app/activity",
      timestamp: log.timestamp
    }));

    const publishItems = snapshot.logs.publish
      .filter((log: LogRecord) => log.level !== "success")
      .slice(0, 4)
      .map((log: LogRecord) => ({
        id: `publish-${log.id}`,
        title: "Publish pipeline",
        body: log.message,
        tone: log.level === "error" ? "error" as const : "warning" as const,
        href: "/app/validation-proofs",
        timestamp: log.timestamp
      }));

    return [...riskItems, ...errorItems, ...publishItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [snapshot]);

  const statusTone = useMemo(() => {
    return publishHealthy && exchangeConnected ? "green" : "amber";
  }, [publishHealthy, exchangeConnected]);

  return (
    <div className="flex h-screen bg-zinc-950">
      <aside
        className={`flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-0"
        } overflow-hidden`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <img src="/logo.png" alt="ProofTrader logo" className="h-8 w-8 rounded-lg object-contain" />
          <div className="flex-1">
            <h1 className="text-white font-semibold">ProofTrader</h1>
            <p className="text-xs text-zinc-400">Autonomous Agent</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <Link to="/app/activity" className="block bg-zinc-800 rounded-lg p-3 transition-colors hover:bg-zinc-700/80">
            <div className="flex items-center gap-2 mb-2">
              <Circle
                className={`w-2 h-2 ${statusTone === "green" ? "fill-green-500 text-green-500" : "fill-amber-500 text-amber-500"}`}
              />
              <span className="text-xs text-zinc-300">System status</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{systemStatus}</p>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-zinc-400 hover:text-white"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <span className="text-white">{environmentLabel}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Environment</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/app/settings" className="flex items-center gap-2">
                      <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                      <span>Production</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/settings" className="flex items-center gap-2">
                      <Circle className="w-2 h-2 fill-amber-500 text-amber-500" />
                      <span>Paper Trading</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden xl:flex items-center gap-2">
                <Link to="/app/settings">
                  <Badge variant="outline" className={exchangeConnected ? "gap-2 border-green-800 bg-green-950/30 hover:bg-green-950/40" : "gap-2 border-red-800 bg-red-950/30 hover:bg-red-950/40"}>
                    <Circle className={`w-2 h-2 ${exchangeConnected ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"}`} />
                    <span className={exchangeConnected ? "text-green-400" : "text-red-400"}>
                      {exchangeConnected ? "Kraken Connected" : "Kraken Offline"}
                    </span>
                  </Badge>
                </Link>
                <Link to="/app/validation-proofs">
                  <Badge variant="outline" className={chainSynced ? "gap-2 border-blue-800 bg-blue-950/30 hover:bg-blue-950/40" : "gap-2 border-amber-800 bg-amber-950/30 hover:bg-amber-950/40"}>
                    <Circle className={`w-2 h-2 ${chainSynced ? "fill-blue-500 text-blue-500" : "fill-amber-500 text-amber-500"}`} />
                    <span className={chainSynced ? "text-blue-400" : "text-amber-400"}>
                      {chainSynced ? "Chain Synced" : "Chain Pending"}
                    </span>
                  </Badge>
                </Link>
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative" aria-label="Open notifications">
                    <Bell className="w-5 h-5 text-zinc-400" />
                    {notifications > 0 ? (
                      <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                        {notifications}
                      </span>
                    ) : null}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="border-zinc-800 bg-zinc-950 text-white sm:max-w-lg">
                  <SheetHeader className="border-b border-zinc-800">
                    <SheetTitle>Notifications</SheetTitle>
                    <SheetDescription className="text-zinc-400">
                      Latest risk alerts, publish warnings, and system errors from the live backend snapshot.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {notificationItems.length === 0 ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                        No active alerts right now.
                      </div>
                    ) : (
                      notificationItems.map((item) => (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="block rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 transition-colors hover:bg-zinc-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {item.tone === "error" ? (
                                <TriangleAlert className="h-4 w-4 text-red-400" />
                              ) : item.tone === "warning" ? (
                                <TriangleAlert className="h-4 w-4 text-amber-400" />
                              ) : (
                                <Info className="h-4 w-4 text-blue-400" />
                              )}
                              <p className="text-sm font-medium text-white">{item.title}</p>
                            </div>
                            <span className="text-xs text-zinc-500">{formatTimestamp(item.timestamp)}</span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">{item.body}</p>
                          <p className="mt-3 text-xs text-zinc-500">Open destination</p>
                        </Link>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" aria-label="Open workspace menu">
                    <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-zinc-400" />
                    </div>
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/app/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/api-keys" className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      <span>API Keys</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/preferences" className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span>Preferences</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/">Back to Landing</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-zinc-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
