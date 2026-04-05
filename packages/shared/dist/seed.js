const trades = [
    {
        id: "TRD-5821",
        accountMode: "spot",
        symbol: "BTC/USD",
        side: "LONG",
        size: 0.42,
        entryPrice: 61850,
        exitPrice: 62450,
        stopLoss: 60800,
        takeProfit: 63500,
        status: "Closed",
        openedAt: "2026-04-02 08:15:23",
        closedAt: "2026-04-02 10:42:18",
        realizedPnL: 255,
        unrealizedPnL: 0,
        fees: 12.5,
        exchangeOrderId: "KRAKEN-O-8XE2D4",
        strategy: "Trend Following",
        signalSummary: "Bullish breakout above resistance",
        riskSummary: "Passed all checks",
        artifactId: "VAL-7821"
    },
    {
        id: "TRD-5820",
        accountMode: "spot",
        symbol: "AVAX/USD",
        side: "LONG",
        size: 150,
        entryPrice: 38.2,
        exitPrice: 39.45,
        stopLoss: 37,
        takeProfit: 41.5,
        status: "Closed",
        openedAt: "2026-04-01 14:22:10",
        closedAt: "2026-04-02 06:15:42",
        realizedPnL: 187.5,
        unrealizedPnL: 0,
        fees: 8.75,
        exchangeOrderId: "KRAKEN-O-9YF3E5",
        strategy: "Mean Reversion",
        signalSummary: "Oversold RSI bounce signal",
        riskSummary: "Passed all checks",
        artifactId: "VAL-7819"
    },
    {
        id: "TRD-5819",
        accountMode: "spot",
        symbol: "ETH/USD",
        side: "SHORT",
        size: 12.5,
        entryPrice: 3350,
        exitPrice: 3315,
        stopLoss: 3420,
        takeProfit: 3250,
        status: "Closed",
        openedAt: "2026-04-01 09:30:15",
        closedAt: "2026-04-01 16:45:30",
        realizedPnL: 437.5,
        unrealizedPnL: 0,
        fees: 16.25,
        exchangeOrderId: "KRAKEN-O-7WD2C3",
        strategy: "Trend Following",
        signalSummary: "Bearish divergence detected",
        riskSummary: "Passed all checks",
        artifactId: "VAL-7818"
    },
    {
        id: "TRD-5818",
        accountMode: "spot",
        symbol: "SOL/USD",
        side: "LONG",
        size: 75,
        entryPrice: 145.8,
        exitPrice: 143.2,
        stopLoss: 142,
        takeProfit: 152,
        status: "Closed",
        openedAt: "2026-03-31 11:20:45",
        closedAt: "2026-03-31 18:30:22",
        realizedPnL: -195,
        unrealizedPnL: 0,
        fees: 9.5,
        exchangeOrderId: "KRAKEN-O-6VC1B2",
        strategy: "Breakout",
        signalSummary: "False breakout",
        riskSummary: "Passed all checks",
        artifactId: "VAL-7817"
    },
    {
        id: "TRD-5817",
        accountMode: "spot",
        symbol: "BTC/USD",
        side: "LONG",
        size: 0.65,
        entryPrice: 59420,
        exitPrice: 61850,
        stopLoss: 58200,
        takeProfit: 63000,
        status: "Closed",
        openedAt: "2026-03-30 07:15:30",
        closedAt: "2026-04-01 05:20:15",
        realizedPnL: 1579.5,
        unrealizedPnL: 0,
        fees: 19.75,
        exchangeOrderId: "KRAKEN-O-5UB0A1",
        strategy: "Trend Following",
        signalSummary: "Strong uptrend continuation",
        riskSummary: "Passed all checks",
        artifactId: "VAL-7816"
    }
];
const positions = [
    {
        id: "POS-1842",
        accountMode: "spot",
        symbol: "BTC/USD",
        side: "LONG",
        size: 0.425,
        entryPrice: 62450,
        currentPrice: 63820,
        stopLoss: 61200,
        takeProfit: 65500,
        unrealizedPnL: 582.25,
        unrealizedPnLPercent: 2.19,
        collateral: 26541.25,
        leverage: 1,
        liquidationPrice: null,
        openedAt: "2026-04-02 08:42:18",
        riskScore: 0.32
    },
    {
        id: "POS-1843",
        accountMode: "spot",
        symbol: "ETH/USD",
        side: "LONG",
        size: 12.5,
        entryPrice: 3240.5,
        currentPrice: 3315.2,
        stopLoss: 3150,
        takeProfit: 3450,
        unrealizedPnL: 933.75,
        unrealizedPnLPercent: 2.3,
        collateral: 40506.25,
        leverage: 1,
        liquidationPrice: null,
        openedAt: "2026-04-01 14:15:32",
        riskScore: 0.28
    },
    {
        id: "POS-1844",
        accountMode: "spot",
        symbol: "SOL/USD",
        side: "SHORT",
        size: 85,
        entryPrice: 142.3,
        currentPrice: 138.75,
        stopLoss: 146.5,
        takeProfit: 135,
        unrealizedPnL: 301.75,
        unrealizedPnLPercent: 2.49,
        collateral: 12095.5,
        leverage: 1,
        liquidationPrice: null,
        openedAt: "2026-04-01 09:22:45",
        riskScore: 0.35
    }
];
const artifacts = [
    {
        id: "VAL-7821",
        type: "Trade Execution",
        intentHash: "0x4f3a9c8b2e1d7a6f5c4b8e2d1a9c7f6b4e8a2c1d9f7e5c3b8a6d4f2e1c9a7b5",
        signatureStatus: "Verified",
        checkpointStatus: "Confirmed",
        onchainReference: "0xf2e8d4c1a9b7c3e5",
        createdAt: "2026-04-02 08:42:30",
        validatorStatus: "Published",
        tradeId: "TRD-5821",
        riskCheckId: "CHK-4521"
    },
    {
        id: "VAL-7820",
        type: "Risk Check",
        intentHash: "0x8e2d1c9f7a6b5e4c3d8a9b7f6e5d4c3a2b1e9d8c7f6a5b4e3d2c1a9f8e7d6c5",
        signatureStatus: "Verified",
        checkpointStatus: "Confirmed",
        onchainReference: "0xa3c7e1f9b5d8a2c4",
        createdAt: "2026-04-02 06:42:18",
        validatorStatus: "Published",
        tradeId: null,
        riskCheckId: "CHK-4520"
    },
    {
        id: "VAL-7819",
        type: "Strategy Update",
        intentHash: "0x1c9b5e7f3a8d6c4e2b9a7f5d3c1e8b6a4f2d9c7e5b3a1f8d6c4e2b9a7f5d3c1",
        signatureStatus: "Verified",
        checkpointStatus: "Confirmed",
        onchainReference: "0xb8d4f2a6c7e9b1d3",
        createdAt: "2026-04-01 14:15:42",
        validatorStatus: "Published",
        tradeId: "TRD-5820",
        riskCheckId: null
    },
    {
        id: "VAL-7818",
        type: "Trade Execution",
        intentHash: "0x7b4e9a2c5f1d8e6b3a9c7f4d2e1b8a6c5f3d9e7b5a3c1f9d7e5b3a1c9f7e5d3",
        signatureStatus: "Verified",
        checkpointStatus: "Confirmed",
        onchainReference: "0xd6b2f8a4e1c9b7d5",
        createdAt: "2026-04-01 09:30:25",
        validatorStatus: "Published",
        tradeId: "TRD-5819",
        riskCheckId: "CHK-4519"
    },
    {
        id: "VAL-7817",
        type: "Risk Check",
        intentHash: "0x9f3c7a1e5b8d2c6a4f9e7b3d1c8a6f4e2b9d7c5a3f1e9d7c5b3a1f9e7d5c3b1",
        signatureStatus: "Verified",
        checkpointStatus: "Pending",
        onchainReference: null,
        createdAt: "2026-04-01 08:22:15",
        validatorStatus: "Processing",
        tradeId: null,
        riskCheckId: "CHK-4518"
    }
];
const attributionByMode = {
    spot: {
        mode: "spot",
        openPositions: positions.filter((position) => position.accountMode === "spot").length,
        closedTrades: trades.filter((trade) => trade.accountMode === "spot" && trade.status === "Closed").length,
        winRate: 80,
        realizedToday: 442.5,
        realizedWeek: 2264.5,
        realizedTotal: 2264.5,
        openUnrealized: 1817.75,
        capitalDeployedUsd: 79143,
        openNotionalUsd: 80357.25,
        maxDrawdown: -4.2,
        averageLeverage: 1,
        equityCurve: [
            { date: "Jan 1", value: 380000 },
            { date: "Jan 15", value: 395000 },
            { date: "Feb 1", value: 410000 },
            { date: "Feb 15", value: 425000 },
            { date: "Mar 1", value: 445000 },
            { date: "Mar 15", value: 470000 },
            { date: "Apr 1", value: 487329 }
        ]
    },
    futures: {
        mode: "futures",
        openPositions: 0,
        closedTrades: 0,
        winRate: 0,
        realizedToday: 0,
        realizedWeek: 0,
        realizedTotal: 0,
        openUnrealized: 0,
        capitalDeployedUsd: 0,
        openNotionalUsd: 0,
        maxDrawdown: 0,
        averageLeverage: 1,
        equityCurve: []
    }
};
export const seedSnapshot = {
    generatedAt: "2026-04-02T20:45:00.000Z",
    system: {
        environment: "Production",
        healthLabel: "All systems operational",
        notifications: 2,
        connections: {
            exchangeConnected: true,
            websocketConnected: true,
            chainSynced: true,
            publishWorkerHealthy: true,
            queueHealthy: true,
            lastSyncLabel: "2 seconds ago",
            rateLimitAvailable: "142/150 calls"
        }
    },
    dashboard: {
        equityCurve: [
            { date: "Jan 1", value: 380000 },
            { date: "Jan 15", value: 395000 },
            { date: "Feb 1", value: 410000 },
            { date: "Feb 15", value: 425000 },
            { date: "Mar 1", value: 445000 },
            { date: "Mar 15", value: 470000 },
            { date: "Apr 1", value: 487329 }
        ],
        metricCards: [
            { label: "Total Equity", value: 487329, format: "currency", change: 12.4, suffix: "All Time" },
            { label: "Available Balance", value: 142891, format: "currency", suffix: "29.3% of equity" },
            { label: "Daily PnL", value: 3247, format: "currency", change: 0.67, suffix: "Today" },
            { label: "Weekly PnL", value: 8942, format: "currency", change: 1.87, suffix: "This Week" }
        ],
        attributionByMode: {
            spot: { ...attributionByMode.spot },
            futures: { ...attributionByMode.futures }
        },
        winRate: 68.3,
        maxDrawdown: -4.2,
        sharpeRatio: 2.14,
        totalTrades: 2847,
        openPositionsPreview: [...positions],
        recentTradesPreview: [...trades.slice(0, 3)],
        recentSignals: [
            { id: "SIG-9421", symbol: "BTC/USD", type: "ENTRY", confidence: 0.78, action: "Executed", time: "12m ago" },
            { id: "SIG-9420", symbol: "MATIC/USD", type: "EXIT", confidence: 0.65, action: "Blocked", time: "45m ago" },
            { id: "SIG-9419", symbol: "ETH/USD", type: "ENTRY", confidence: 0.82, action: "Executed", time: "2h ago" }
        ],
        recentArtifacts: [...artifacts.slice(0, 3)]
    },
    paper: {
        status: "idle",
        source: "snapshot",
        initialized: false,
        syncedAt: null,
        accountMode: "spot",
        leverage: 1,
        equity: 487329,
        balance: 142891,
        unrealizedPnL: 1817.75,
        realizedPnL: 2264.5,
        tradeCount: trades.length,
        openPositionCount: positions.length,
        lastError: null,
        recentOrders: [
            {
                id: "PAPER-1003",
                exchangeOrderId: "KRAKEN-O-8XE2D4",
                accountMode: "spot",
                symbol: "BTC/USD",
                side: "LONG",
                size: 0.425,
                price: 62450,
                orderType: "market",
                status: "filled",
                timestamp: "2026-04-02 08:42:30"
            },
            {
                id: "PAPER-1002",
                exchangeOrderId: "KRAKEN-O-9YF3E5",
                accountMode: "spot",
                symbol: "AVAX/USD",
                side: "LONG",
                size: 150,
                price: 39.45,
                orderType: "limit",
                status: "filled",
                timestamp: "2026-04-02 06:15:42"
            },
            {
                id: "PAPER-1001",
                exchangeOrderId: "KRAKEN-O-7WD2C3",
                accountMode: "spot",
                symbol: "ETH/USD",
                side: "SHORT",
                size: 12.5,
                price: 3315,
                orderType: "market",
                status: "filled",
                timestamp: "2026-04-01 16:45:30"
            }
        ]
    },
    trades: [...trades],
    positions: [...positions],
    strategy: {
        selectedStrategy: "Trend Following",
        currentMode: "Trend",
        marketRegime: "Bullish",
        readiness: "Ready",
        signalsToday: 24,
        executedToday: 18,
        blockedToday: 6,
        performance: [
            { date: "Jan", equity: 380000, drawdown: -2.1 },
            { date: "Feb", equity: 410000, drawdown: -1.8 },
            { date: "Mar", equity: 445000, drawdown: -3.2 },
            { date: "Apr", equity: 487329, drawdown: -1.4 }
        ],
        eventHistory: [
            { id: "EVT-9421", type: "Signal Generated", symbol: "BTC/USD", action: "ENTRY", confidence: 0.78, outcome: "Executed", timestamp: "2026-04-02 08:15:23" },
            { id: "EVT-9420", type: "Risk Block", symbol: "MATIC/USD", action: "EXIT", confidence: 0.65, outcome: "Blocked - Daily loss limit", timestamp: "2026-04-02 06:42:10" },
            { id: "EVT-9419", type: "Signal Generated", symbol: "ETH/USD", action: "ENTRY", confidence: 0.82, outcome: "Executed", timestamp: "2026-04-01 14:22:15" },
            { id: "EVT-9418", type: "Mode Change", symbol: "N/A", action: "TREND → MEAN_REVERSION", confidence: null, outcome: "Market regime shifted", timestamp: "2026-04-01 11:30:00" },
            { id: "EVT-9417", type: "Signal Generated", symbol: "SOL/USD", action: "EXIT", confidence: 0.71, outcome: "Executed", timestamp: "2026-04-01 09:15:42" }
        ],
        aiCommentary: [
            { label: "Bullish Signal", tone: "positive", timestamp: "2h ago", body: "BTC/USD is showing strong trend continuation with higher highs, stronger volume on breakout attempts, and acceptable spread conditions for the current risk policy." },
            { label: "Market Regime", tone: "neutral", timestamp: "6h ago", body: "Short-term structure remains bullish, but extension is getting stretched on lower timeframes. New entries should prioritize pullback confirmation over aggressive chasing." }
        ],
        allowedSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "AVAX/USD"],
        monitoredTimeframes: ["15m", "1h", "4h"],
        entryRules: [
            "Only trade symbols on the whitelist",
            "Require regime alignment across 1h and 4h",
            "Reject entries when spread exceeds the configured guardrail",
            "Reject signals when cooldown is active"
        ],
        exitRules: [
            "Hard stop loss on every position",
            "Take profit at predefined levels",
            "Reduce risk when volatility spikes",
            "Pause new entries when drawdown thresholds are hit"
        ],
        executionPolicy: "Market orders with protective stop and take-profit envelopes",
        positionSizing: "0.5% account risk per trade",
        maxConcurrentPositions: 5,
        marketConditions: {
            Volatility: "Moderate",
            "Trend Strength": "Strong",
            Liquidity: "High"
        },
        paused: false,
        runner: {
            enabled: false,
            status: "Stopped",
            cadenceSeconds: 60,
            confidenceThreshold: 0.68,
            tradeSizeUsd: 750,
            maxTradesPerDay: 4,
            cooldownAfterLosses: 3,
            lastRunAt: null,
            lastSignalAt: null,
            lastTradeAt: null,
            watchedSymbols: ["BTC/USD", "ETH/USD", "SOL/USD", "AVAX/USD"],
            latestSummary: "Strategy runner is idle."
        },
        ai: {
            enabled: true,
            provider: "llm",
            model: "demo-strategy-analyst",
            status: "Ready",
            lastDecisionAt: "2026-04-02 20:44:38",
            recommendedAction: "LONG",
            recommendedSymbol: "BTC/USD",
            confidence: 0.74,
            rationale: "Momentum and spread expansion both supported a continuation bias on BTC/USD while the rest of the watchlist stayed constructive.",
            riskNote: "BTC/USD remained inside per-trade size, daily loss, and whitelist guardrails.",
            error: null,
            futuresThrottle: {
                mode: "futures",
                active: false,
                posture: "Normal",
                score: 0,
                blockNewEntries: false,
                adjustedConfidenceThreshold: 0.68,
                adjustedMaxTradesPerDay: 4,
                adjustedTradeSizeUsd: 750,
                leverageCap: 4,
                sizeFactor: 1,
                summary: "Futures throttle is normal. No extra AI restrictions are active.",
                reasons: [],
                dailyLossUtilization: 0,
                drawdownUtilization: 0,
                exposureUtilization: 0,
                minLiquidationBufferPercent: null,
                lossStreak: 0,
                winRate: 0
            },
            futuresDefense: {
                mode: "futures",
                active: false,
                posture: "Normal",
                status: "Idle",
                action: "HOLD",
                summary: "No automated futures defense action is needed right now.",
                targetPositionId: null,
                targetSymbol: null,
                reasons: [],
                liveLiquidationBufferPercent: null,
                lossOnCollateralPercent: null,
                unrealizedPnL: null,
                appliedAt: null
            },
            positionExitEngine: {
                active: true,
                status: "Monitoring",
                action: "HOLD",
                summary: "Auto exits are armed and watching all open positions for stop-loss or take-profit triggers.",
                targetPositionId: null,
                targetSymbol: null,
                targetAccountMode: null,
                reasons: [],
                stopTriggeredCount: 0,
                takeProfitTriggeredCount: 0,
                appliedAt: null,
                lastExitPrice: null,
                lastRealizedPnL: null
            }
        }
    },
    risk: {
        policy: {
            maxDailyLossUsd: 5000,
            maxWeeklyDrawdownPercent: 4,
            maxPositionSizeUsd: 50000,
            maxConcurrentPositions: 5,
            perTradeRiskPercent: 0.5,
            cooldownAfterLosses: 3,
            volatilityGuardrailPercent: 25,
            spreadGuardrailPercent: 0.15,
            slippageGuardrailPercent: 0.2,
            futuresMaxLeverage: 4,
            futuresMaxDailyLossUsd: 2500,
            futuresMaxDrawdownPercent: 3,
            futuresMaxPositionNotionalUsd: 30000,
            futuresMaxOpenNotionalUsd: 75000,
            futuresMinLiquidationDistancePercent: 18,
            whitelistedMarkets: ["BTC/USD", "ETH/USD", "SOL/USD", "AVAX/USD"]
        },
        checks: [
            { id: "CHK-4521", check: "Max Daily Loss", status: "Passed", value: "-$1,247", limit: "-$5,000", utilization: 24.9, timestamp: "2026-04-02 08:15:23" },
            { id: "CHK-4520", check: "Max Position Size", status: "Passed", value: "$40,506", limit: "$50,000", utilization: 81.0, timestamp: "2026-04-02 08:15:23" },
            { id: "CHK-4519", check: "Max Concurrent Positions", status: "Passed", value: "3", limit: "5", utilization: 60.0, timestamp: "2026-04-02 08:15:23" },
            { id: "CHK-4518", check: "Volatility Guardrail", status: "Passed", value: "12.4%", limit: "25.0%", utilization: 49.6, timestamp: "2026-04-02 06:42:10" }
        ],
        blockedTradeIntents: [
            { id: "BLK-2847", symbol: "MATIC/USD", side: "LONG", reason: "Daily loss limit approaching", riskScore: 0.89, timestamp: "2026-04-02 06:42:10" },
            { id: "BLK-2846", symbol: "DOGE/USD", side: "LONG", reason: "Symbol not whitelisted", riskScore: null, timestamp: "2026-04-01 15:30:22" },
            { id: "BLK-2845", symbol: "BTC/USD", side: "SHORT", reason: "Spread too wide (0.15%)", riskScore: 0.72, timestamp: "2026-04-01 11:18:45" }
        ],
        events: [
            { id: "EVT-8421", type: "Circuit Breaker", severity: "High", message: "Daily loss threshold at 80% - Trading paused for 2 hours", timestamp: "2026-03-28 14:30:00", resolved: true },
            { id: "EVT-8420", type: "Position Limit", severity: "Medium", message: "Max concurrent positions reached - New signals blocked", timestamp: "2026-03-25 09:15:00", resolved: true },
            { id: "EVT-8419", type: "Volatility Spike", severity: "Medium", message: "Market volatility exceeded 20% - Position sizing reduced", timestamp: "2026-03-22 16:45:00", resolved: true }
        ],
        circuitBreaker: "Normal",
        blockedTrades24h: 6
    },
    validation: {
        identity: {
            agentName: "ProofTrader",
            agentWallet: "0x742d35BA62f8c9e4c8f7b2a9d3e1c8b6a4f2d9c7",
            registrationStatus: "Active",
            network: "Sepolia",
            registrationBlock: 18542391,
            validationStandard: "ERC-8004",
            identityRegistry: "0x0000000000000000000000000000000000000000",
            agentId: 1
        },
        artifacts: [...artifacts],
        trustScore: 98.4,
        publishRate: 99.8,
        totalProofs: 2847,
        activeSince: "Jan 2026",
        reputationSummary: [
            { label: "Success rate", value: "89%" },
            { label: "Trading yield (30d)", value: "+6.8%" },
            { label: "Validation average", value: "97/100" },
            { label: "Endpoint uptime", value: "99.77%" }
        ]
    },
    logs: {
        execution: [
            { id: "EXE-9821", timestamp: "2026-04-02 08:42:30", level: "info", message: "Order filled: BTC/USD LONG 0.425 @ $62,450.00", details: { orderId: "KRAKEN-O-8XE2D4", fillPrice: 62450, size: 0.425 } },
            { id: "EXE-9820", timestamp: "2026-04-02 08:42:18", level: "info", message: "Order placed: BTC/USD LONG 0.425", details: { orderId: "KRAKEN-O-8XE2D4", type: "MARKET" } },
            { id: "EXE-9819", timestamp: "2026-04-02 06:42:10", level: "warning", message: "Order rejected: Insufficient balance", details: { symbol: "MATIC/USD", requestedSize: 500 } }
        ],
        signal: [
            { id: "SIG-7421", timestamp: "2026-04-02 08:15:23", level: "info", message: "Signal generated: BTC/USD ENTRY", details: { confidence: 0.78, type: "TREND", strength: "STRONG" } },
            { id: "SIG-7420", timestamp: "2026-04-02 06:42:10", level: "info", message: "Signal generated: MATIC/USD EXIT", details: { confidence: 0.65, type: "RISK_MANAGEMENT", strength: "MODERATE" } },
            { id: "SIG-7419", timestamp: "2026-04-01 14:22:15", level: "info", message: "Signal generated: ETH/USD ENTRY", details: { confidence: 0.82, type: "MOMENTUM", strength: "STRONG" } }
        ],
        risk: [
            { id: "RSK-5821", timestamp: "2026-04-02 08:15:25", level: "info", message: "Risk check passed: All limits satisfied", details: { checks: ["DAILY_LOSS", "POSITION_SIZE", "CONCURRENT_POSITIONS"] } },
            { id: "RSK-5820", timestamp: "2026-04-02 06:42:12", level: "warning", message: "Trade blocked: Daily loss limit approaching", details: { currentLoss: -4800, limit: -5000, utilization: 96 } },
            { id: "RSK-5819", timestamp: "2026-04-01 15:30:22", level: "error", message: "Trade blocked: Symbol not whitelisted", details: { symbol: "DOGE/USD", action: "BLOCKED" } }
        ],
        publish: [
            { id: "PUB-4721", timestamp: "2026-04-02 08:42:35", level: "success", message: "Validation artifact published to chain", details: { artifactId: "VAL-7821", txHash: "0xf2e8d4c1a9b7c3e5" } },
            { id: "PUB-4720", timestamp: "2026-04-02 06:42:25", level: "success", message: "Validation artifact published to chain", details: { artifactId: "VAL-7820", txHash: "0xa3c7e1f9b5d8a2c4" } },
            { id: "PUB-4719", timestamp: "2026-04-01 14:15:55", level: "success", message: "Validation artifact published to chain", details: { artifactId: "VAL-7819", txHash: "0xb8d4f2a6c7e9b1d3" } }
        ],
        error: [
            { id: "ERR-3421", timestamp: "2026-04-01 18:22:15", level: "error", message: "RPC connection timeout", details: { endpoint: "https://mainnet.infura.io", timeout: 30000 } },
            { id: "ERR-3420", timestamp: "2026-04-01 09:45:30", level: "error", message: "Exchange API rate limit exceeded", details: { exchange: "Kraken", retryAfter: 60 } }
        ],
        jobs: [
            { id: "JOB-8921", type: "Market Data Sync", status: "Running", progress: 75, startedAt: "2026-04-02 08:00:00" },
            { id: "JOB-8920", type: "Proof Publishing", status: "Completed", progress: 100, startedAt: "2026-04-02 08:42:30" },
            { id: "JOB-8919", type: "Position Reconciliation", status: "Completed", progress: 100, startedAt: "2026-04-02 06:00:00" }
        ]
    },
    settings: {
        exchange: {
            apiKey: "kraken_live_abc123xyz789",
            apiSecret: "secret_key_789xyz123abc",
            connected: true,
            paperTrading: false,
            accountMode: "spot",
            futuresLeverage: 2
        },
        blockchain: {
            network: "sepolia",
            rpcEndpoint: "https://ethereum-sepolia-rpc.publicnode.com",
            chainId: 11155111,
            identityRegistry: "0x0000000000000000000000000000000000000000",
            validationRegistry: "0x0000000000000000000000000000000000000000",
            reputationRegistry: "0x0000000000000000000000000000000000000000"
        },
        notifications: {
            slackWebhook: "",
            emailAlerts: true,
            pushAlerts: true,
            dailyDigest: true
        },
        identity: {
            agentName: "ProofTrader",
            agentDescription: "Autonomous crypto trading agent with verifiable trust artifacts.",
            agentWallet: "0x742d35BA62f8c9e4c8f7b2a9d3e1c8b6a4f2d9c7",
            registrationUri: "https://prooftrader.app/.well-known/agent-registration.json"
        },
        team: [
            { id: "TM-1", name: "Isaac", role: "Founder", email: "founder@example.com" },
            { id: "TM-2", name: "Operator", role: "Risk Operator", email: "ops@example.com" }
        ]
    }
};
