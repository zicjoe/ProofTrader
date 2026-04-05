# Strategy upgrade: regime switched, volatility sized, execution aware

This version upgrades the runner from a simple candidate picker into a bounded professional stack:

- 1h candles drive regime and higher-timeframe bias
- 15m candles measure setup quality and ATR structure
- 5m candles handle entry pressure and stretch
- Kraken public order-book depth is used to estimate spread, liquidity, imbalance, and execution quality
- The AI layer ranks bounded candidates only after the quant feature engine produces valid modules
- The deterministic guard layer still enforces spread, liquidity, correlated exposure, and sizing constraints

## Modules

1. Trend Continuation
   - Trades with aligned 1h and 15m structure
   - Prefers healthy execution quality and contained spread
   - Uses ATR-aware stop placement and 2.2R style target envelope

2. Breakout Expansion
   - Requires strong 5m breakout pressure plus acceptable order-book context
   - Avoids weak books and wide spreads
   - Uses tighter ATR-aware stops with faster payoff targets

3. Mean Reversion
   - Only activates in range-friendly conditions
   - Uses stretch scores and range position
   - Runs smaller size and tighter exits than trend modules

## Professional overlays

- ATR-aware risk budgeting
- Execution-quality penalty in size calculation
- Liquidity cap based on visible order-book depth
- Spread guardrail
- Correlated exposure cap for same-side major USD spot positions
- Daily trade cap and cooldown after consecutive losses
