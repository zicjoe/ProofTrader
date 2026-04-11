import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  ArrowRight,
  Shield,
  Zap,
  LineChart,
  CheckCircle,
  Database,
  Network,
  Lock,
  TrendingUp,
  Activity,
  Brain,
} from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ProofTrader logo" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="text-xl font-bold">ProofTrader</h1>
              <p className="text-xs text-zinc-400">Autonomous Trading Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/app">
              <Button variant="ghost">View Demo</Button>
            </Link>
            <Link to="/app">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mb-6 border-blue-800 bg-blue-950 text-blue-300">
            Hosted Execution • Risk Controlled • Paper Trading Ready
          </Badge>
          <h1 className="mb-6 text-5xl font-bold leading-tight">
            AI Assisted Crypto Trading with
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-violet-600 bg-clip-text text-transparent">
              Verifiable Execution
            </span>
          </h1>
          <p className="mb-8 text-xl leading-relaxed text-zinc-400">
            ProofTrader combines AI assisted trade selection, backend risk controls, hosted Kraken
            CLI execution, and persistent trading visibility in one platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/app">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Launch App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/app">
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Hosted Execution</span>
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mb-2 text-2xl font-bold text-white">Kraken CLI Runner</div>
              <div className="text-sm text-zinc-400">
                Orders flow through a hosted runner instead of depending on a local terminal session.
              </div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Trading Modes</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div className="mb-2 text-2xl font-bold text-white">Spot + Futures</div>
              <div className="text-sm text-zinc-400">
                Supports paper trading workflows across both spot and futures from one dashboard.
              </div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Risk Controls</span>
                <Shield className="h-4 w-4 text-violet-500" />
              </div>
              <div className="mb-2 text-2xl font-bold text-white">Backend Owned</div>
              <div className="text-sm text-zinc-400">
                AI recommendations remain bounded by portfolio, leverage, and execution rules.
              </div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Visibility</span>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mb-2 text-2xl font-bold text-white">Persistent State</div>
              <div className="text-sm text-zinc-400">
                Dashboard metrics, positions, logs, and account state stay observable across the app.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl font-bold">A Trading Platform, Not a Black Box Bot</h2>
            <p className="mb-6 text-lg text-zinc-400">
              Many trading bots hide the decision path behind a single performance claim.
              ProofTrader is built to make trading activity easier to inspect, evaluate, and trust.
            </p>
            <ul className="space-y-4">
              {[
                "AI assisted trade selection without removing backend control",
                "Structured risk checks before execution is allowed",
                "Hosted Kraken CLI execution path for cloud-based operation",
                "Persistent logs, positions, and dashboard state for reviewability",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span className="text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-950">
                    <Brain className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">Strategy Evaluation Layer</h3>
                    <p className="text-sm text-zinc-400">
                      The strategy engine scans for trade candidates while AI helps rank or reject
                      them inside bounded rules.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-violet-950">
                    <Shield className="h-6 w-6 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">Risk Control Layer</h3>
                    <p className="text-sm text-zinc-400">
                      Exposure caps, leverage limits, cooldowns, and execution filters stay
                      authoritative over AI output.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-green-950">
                    <LineChart className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">Execution and Visibility</h3>
                    <p className="text-sm text-zinc-400">
                      Trades, positions, balance changes, and decision logs remain visible through
                      the dashboard and persisted backend state.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Structured Execution for Real Operations</h2>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400">
            ProofTrader keeps execution hosted, observable, and connected to the rest of the
            application state instead of treating order placement as a disconnected script.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <Zap className="mb-4 h-10 w-10 text-amber-500" />
              <h3 className="mb-2 text-xl font-semibold">Hosted Runner Path</h3>
              <p className="text-zinc-400">
                The backend talks to a cloud-hosted runner that executes through Kraken CLI and
                keeps the intended deployment path online.
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <Database className="mb-4 h-10 w-10 text-blue-500" />
              <h3 className="mb-2 text-xl font-semibold">Persistent Application State</h3>
              <p className="text-zinc-400">
                PostgreSQL and Prisma keep workspace state, positions, trades, and dashboard
                hydration consistent across sessions.
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <Network className="mb-4 h-10 w-10 text-violet-500" />
              <h3 className="mb-2 text-xl font-semibold">Operational Visibility</h3>
              <p className="text-zinc-400">
                Logs, synced metrics, and position state help the user understand what the system
                is doing and why.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">How ProofTrader Works</h2>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400">
            A complete trading workflow that keeps strategy evaluation, execution, and state
            changes connected inside one system.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-4">
          {[
            {
              step: "01",
              title: "Evaluate Market",
              description:
                "The engine scans watched pairs, ranks trade candidates, and decides whether conditions are good enough to act.",
            },
            {
              step: "02",
              title: "Apply Risk Rules",
              description:
                "Risk policy, exposure limits, leverage caps, and execution filters decide whether a candidate is allowed.",
            },
            {
              step: "03",
              title: "Execute Through Runner",
              description:
                "Approved orders flow from the API to the hosted kraken-runner and into Kraken CLI for paper execution.",
            },
            {
              step: "04",
              title: "Sync State and Logs",
              description:
                "Positions, balances, metrics, and logs are persisted and reflected back into the dashboard for review.",
            },
          ].map((item) => (
            <div key={item.step} className="relative">
              <div className="mb-4 text-6xl font-bold text-zinc-800">{item.step}</div>
              <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
              <p className="text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Built on a Real Product Stack</h2>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400">
            The architecture is designed around a deployed application flow, not just a local
            script or isolated trading demo.
          </p>
        </div>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-8">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <h3 className="mb-4 font-semibold text-blue-400">Frontend</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>• React + TypeScript</li>
                  <li>• Vite application</li>
                  <li>• Tailwind UI</li>
                  <li>• Live dashboard views</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-4 font-semibold text-violet-400">Backend</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>• Fastify API server</li>
                  <li>• PostgreSQL database</li>
                  <li>• Prisma persistence layer</li>
                  <li>• Strategy and risk services</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-4 font-semibold text-green-400">Execution</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>• Railway hosted kraken-runner</li>
                  <li>• Kraken CLI execution layer</li>
                  <li>• Paper trading workflows</li>
                  <li>• Exportable proof and identity outputs</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-8">
              <Lock className="mb-6 h-12 w-12 text-blue-500" />
              <h3 className="mb-4 text-2xl font-bold">Trust Through Reviewability</h3>
              <p className="mb-6 text-zinc-400">
                Traditional trading bots often hide execution logic behind surface-level metrics.
                ProofTrader is built to expose state, logs, and execution flow more clearly.
              </p>
              <p className="text-zinc-400">
                That makes it easier to evaluate decisions, monitor risk posture, and understand
                how the platform behaves over time without pretending the system is a black box.
              </p>
            </CardContent>
          </Card>
          <div>
            <h2 className="mb-6 text-3xl font-bold">Why It Matters</h2>
            <ul className="space-y-4">
              {[
                {
                  title: "Auditability",
                  description:
                    "Trade flow, position state, and system behavior can be reviewed from the dashboard and backend logs.",
                },
                {
                  title: "Accountability",
                  description:
                    "AI assists with trade selection, but execution remains bounded by backend-owned controls.",
                },
                {
                  title: "Deployability",
                  description:
                    "The hosted runner path makes the product closer to real cloud operation than a local-only script.",
                },
                {
                  title: "Trust",
                  description:
                    "Clear system state helps users judge the platform by observable behavior instead of marketing claims.",
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-green-500" />
                  <div>
                    <h4 className="mb-1 font-semibold">{item.title}</h4>
                    <p className="text-sm text-zinc-400">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <Card className="border-blue-800 bg-gradient-to-br from-blue-950 to-violet-950">
          <CardContent className="p-12 text-center">
            <h2 className="mb-4 text-4xl font-bold">Ready to Explore ProofTrader?</h2>
            <p className="mx-auto mb-8 max-w-2xl text-xl text-zinc-300">
              Launch the app to review the dashboard, initialize paper trading, and inspect the
              strategy, positions, and risk workflow directly.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/app">
                <Button size="lg" className="bg-white text-zinc-900 hover:bg-zinc-100">
                  Launch App
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/app">
                <Button size="lg" variant="outline" className="border-zinc-600 text-white">
                  View Demo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-8 grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <img src="/logo.png" alt="ProofTrader logo" className="h-8 w-8 rounded-lg object-cover" />
                <span className="font-bold">ProofTrader</span>
              </div>
              <p className="text-sm text-zinc-400">
                AI assisted crypto trading with hosted execution, risk controls, and persistent
                dashboard visibility.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>Dashboard</li>
                <li>Strategy Engine</li>
                <li>Positions</li>
                <li>Paper Trading</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Stack</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>React + Vite</li>
                <li>Fastify + Prisma</li>
                <li>PostgreSQL</li>
                <li>Kraken CLI Runner</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Access</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>
                  <Link to="/app" className="hover:text-white">
                    Launch App
                  </Link>
                </li>
                <li>
                  <Link to="/app" className="hover:text-white">
                    View Demo
                  </Link>
                </li>
                <li>Hosted runner enabled</li>
                <li>Paper trading workflow</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-8 text-center text-sm text-zinc-400">
            <p>© 2026 ProofTrader. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
