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
      {/* Navigation */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ProofTrader logo" className="h-10 w-10 rounded-lg object-contain" />
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
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-6 bg-blue-950 text-blue-400 border-blue-800">
            Verifiable Autonomous Trading
          </Badge>
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            AI-Powered Trading with
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-violet-600 bg-clip-text text-transparent">
              On-Chain Proof of Integrity
            </span>
          </h1>
          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
            ProofTrader combines autonomous AI trading agents, institutional-grade risk controls,
            and blockchain-based validation to deliver transparent, trustworthy automated trading.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/app">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Launch App
                <ArrowRight className="ml-2 w-5 h-5" />
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

      {/* Metrics Preview */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-4 gap-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Total Equity</span>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">$487,329</div>
              <div className="text-sm text-green-500">+12.4% All Time</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Win Rate</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">68.3%</div>
              <div className="text-sm text-zinc-400">342 Trades</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Sharpe Ratio</span>
                <LineChart className="w-4 h-4 text-violet-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">2.14</div>
              <div className="text-sm text-zinc-400">Risk-Adjusted</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Proofs Published</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">2,847</div>
              <div className="text-sm text-zinc-400">Verified On-Chain</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">
              Autonomous Trading You Can Trust
            </h2>
            <p className="text-lg text-zinc-400 mb-6">
              Traditional automated trading systems operate as black boxes. ProofTrader changes
              that with cryptographic proof of every decision, action, and outcome.
            </p>
            <ul className="space-y-4">
              {[
                "AI-powered market analysis and trade execution",
                "Real-time risk management with circuit breakers",
                "Every action recorded and verified on-chain",
                "Full transparency without compromising strategy",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-950 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">AI Strategy Engine</h3>
                    <p className="text-sm text-zinc-400">
                      Advanced models analyze market conditions and identify high-probability setups
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-violet-950 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Risk Control Layer</h3>
                    <p className="text-sm text-zinc-400">
                      Every trade must pass strict risk checks before execution
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-950 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Proof Publishing</h3>
                    <p className="text-sm text-zinc-400">
                      Cryptographic validation artifacts published to immutable ledger
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Execution Layer */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Professional-Grade Execution
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Direct integration with Kraken's institutional API delivers fast, reliable execution
            with real-time order management.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <Zap className="w-10 h-10 text-amber-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-zinc-400">
                Sub-second order placement with smart routing and minimal slippage
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <Database className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Reliable Infrastructure</h3>
              <p className="text-zinc-400">
                Built on battle-tested stack with PostgreSQL, Redis, and robust job queues
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <Network className="w-10 h-10 text-violet-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Enterprise Ready</h3>
              <p className="text-zinc-400">
                Comprehensive logging, monitoring, and alerting for mission-critical operations
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How ProofTrader Works</h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            A complete autonomous trading workflow with verification at every step
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            {
              step: "01",
              title: "Market Analysis",
              description: "AI continuously monitors market conditions and identifies trading opportunities",
            },
            {
              step: "02",
              title: "Risk Validation",
              description: "Every signal passes through strict risk controls before execution approval",
            },
            {
              step: "03",
              title: "Execute Trade",
              description: "Approved orders execute instantly through Kraken with optimal routing",
            },
            {
              step: "04",
              title: "Publish Proof",
              description: "Trade metadata and validation artifacts recorded on-chain for verification",
            },
          ].map((item) => (
            <div key={item.step} className="relative">
              <div className="text-6xl font-bold text-zinc-800 mb-4">{item.step}</div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Built on Proven Technology</h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Production-ready architecture designed for reliability and scale
          </p>
        </div>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-semibold mb-4 text-blue-400">Frontend</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>• React & TypeScript</li>
                  <li>• Next.js Framework</li>
                  <li>• Tailwind CSS</li>
                  <li>• Real-time WebSockets</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4 text-violet-400">Backend</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>• Fastify API Server</li>
                  <li>• PostgreSQL Database</li>
                  <li>• Prisma ORM</li>
                  <li>• Redis Cache & Queue</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4 text-green-400">Integration</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>• Kraken Exchange CLI</li>
                  <li>• ERC-8004 Identity</li>
                  <li>• On-chain Proofs</li>
                  <li>• Smart Contracts</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Why Verifiable Trading Matters */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8">
              <Lock className="w-12 h-12 text-blue-500 mb-6" />
              <h3 className="text-2xl font-bold mb-4">Trust Through Transparency</h3>
              <p className="text-zinc-400 mb-6">
                Traditional trading bots are black boxes. You can't verify their decisions,
                validate their risk management, or prove their performance claims.
              </p>
              <p className="text-zinc-400">
                ProofTrader uses cryptographic proofs to create an immutable audit trail of
                every action, giving you verifiable transparency without exposing strategy secrets.
              </p>
            </CardContent>
          </Card>
          <div>
            <h2 className="text-3xl font-bold mb-6">Why It Matters</h2>
            <ul className="space-y-4">
              {[
                {
                  title: "Auditability",
                  description: "Every decision and action is recorded and can be independently verified",
                },
                {
                  title: "Accountability",
                  description: "Cryptographic signatures prove agent identity and intent",
                },
                {
                  title: "Compliance",
                  description: "Complete audit trail for regulatory requirements",
                },
                {
                  title: "Trust",
                  description: "Verifiable proof builds confidence with investors and partners",
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-zinc-400">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <Card className="bg-gradient-to-br from-blue-950 to-violet-950 border-blue-800">
          <CardContent className="p-12 text-center">
            <h2 className="text-4xl font-bold mb-4">
              Ready to Start Trading with Confidence?
            </h2>
            <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
              Join the future of transparent, verifiable autonomous trading
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/app">
                <Button size="lg" className="bg-white text-zinc-900 hover:bg-zinc-100">
                  Launch App
                  <ArrowRight className="ml-2 w-5 h-5" />
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

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="ProofTrader logo" className="h-8 w-8 rounded-lg object-contain" />
                <span className="font-bold">ProofTrader</span>
              </div>
              <p className="text-sm text-zinc-400">
                Autonomous AI trading with on-chain proof of integrity
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">API Reference</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
                <li><a href="#" className="hover:text-white">Compliance</a></li>
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
