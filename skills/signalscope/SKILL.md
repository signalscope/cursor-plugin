---
name: signalscope
description: >
  Interact with the SignalScope stock breakout signal detection platform at signalscopes.com.
  Use the MCP tools to query trending signals, deep-dive individual tickers, explore
  co-occurrence networks, generate AI reports with trade setups, and manage portfolio
  and watchlist. Use when the user asks about stock signals, breakout candidates,
  screening for setups, or wants to check or manage their SignalScope data.
---

# SignalScope Skill

## Overview

SignalScope is a stock breakout signal detection platform. It harvests signals from Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, and volume spikes — scores them with AI, filters pump-and-dump candidates, and surfaces validated tickers ranked by confidence.

**Base URL:** `https://signalscopes.com`

## Authentication

Two auth methods — configure one in the MCP server environment:

**API key** (`SIGNALSCOPE_API_KEY`): Requires a SignalScope subscription. Generate at signalscopes.com/profile. Flat monthly/yearly rate with full access and a daily API request quota.

**x402 pay-per-call** (`SIGNALSCOPE_WALLET_PRIVATE_KEY`): No account or subscription needed. Set an Ethereum wallet private key with USDC on Base. Each call deducts a small amount automatically ($0.005–$0.05 depending on endpoint). Costs are per-request only — no fixed fees.

Two tools always work without any auth:
- `search_tickers` — free symbol discovery
- `get_methodology` — platform methodology

## Key Concepts

- **Scan**: A complete harvest run across all sources, producing a set of validated tickers
- **Signal stage**: How confirmed a breakout signal is (Emerging → Building → Consensus)
  - `Emerging` — detected from 1 source
  - `Building` — detected from 2 sources
  - `Consensus` — detected from 3+ sources
  - `Filtered` — flagged as potential pump-and-dump (hidden by default)
- **AI Score**: 0–100 confidence score. 70+ is strong, 50–70 moderate, below 50 weak
- **Opportunity Score**: Early-mover rank within the scan (separate from AI score)
- **Trending**: Tickers appearing in 2+ scans within 30 days, with trend direction (rising/falling/stable)
- **P&D flags**: 11 statistical pump-and-dump detection flags; tickers with 3+ flags are staged as FILTERED
- **Trade setup**: AI-generated entry range, stop loss, targets, timeframe, and risk/reward ratio — available for Buy/Strong Buy recommendations

## Available MCP Tools

### Discovery (free — no API key)

| Tool | Description |
|------|-------------|
| `search_tickers` | Search by symbol or partial name — returns up to 8 results with AI score, stage, and price |
| `get_methodology` | Platform methodology and scoring pipeline details |

### Signal Data (API key or x402 required)

| Tool | x402 cost | Description |
|------|-----------|-------------|
| `get_trending` | $0.01 | Trending breakout tickers with rich filtering (stage, trend, market cap, sector, source, etc.) |
| `get_ticker` | $0.005 | Latest validated data + raw signals for a symbol |
| `get_ticker_history` | $0.005 | Historical scan appearances for a ticker |
| `get_ticker_performance` | $0.005 | Price performance — 1d, 3d, 7d, 30d returns since signal detection |
| `get_ticker_related` | $0.005 | Co-occurring tickers with Jaccard similarity scores |
| `get_ticker_network` | $0.01 | Co-occurrence network graph (nodes = tickers, edges = co-occurrence strength) |
| `generate_report` | $0.05 | AI report + trade setup with entry range, stop loss, targets, risk/reward |
| `list_scans` | free* | List recent harvest scans |
| `get_scan` | free* | Detail of a specific scan with all validated tickers |
| `get_signals` | free* | Raw signals (individual posts, filings, data points) for a scan |

*API key required; not monetized via x402.

### Portfolio (API key required)

| Tool | Description |
|------|-------------|
| `list_portfolio` | All positions — open and closed |
| `add_position` | Open a new position (symbol, entryPrice, shares, notes) |
| `update_position` | Update or close a position (set status: CLOSED + closePrice to close) |
| `delete_position` | Permanently delete a position |
| `get_portfolio_performance` | Platform-wide performance stats — win rate, avg/median return by AI score range and weekly cohort |

### Watchlist (API key required)

| Tool | Description |
|------|-------------|
| `list_watchlist` | Watchlist with enriched ticker data, scores, and performance |
| `add_to_watchlist` | Add a symbol to watchlist (idempotent) |
| `remove_from_watchlist` | Remove a symbol from watchlist |

### Utility (API key required)

| Tool | Description |
|------|-------------|
| `get_prices` | Current prices for up to 50 symbols (5-min cache) |
| `get_platform_stats` | Platform-wide stats — scan counts, tickers, signals, users |

## Common Workflows

### Morning signal scan

```
1. get_trending (stage: Consensus, trend: rising, hidePnd: true) → find the strongest Consensus-stage breakouts
2. get_ticker (symbol: <top result>) → deep-dive the leading candidate
3. generate_report (symbol: <top result>) → get AI thesis + trade setup
4. add_to_watchlist / add_position → track or enter the trade
```

### Discover and screen

```
1. search_tickers (query: "semi") → find semiconductor-related tickers
2. get_trending (sector: "Technology", marketCap: "micro", sortBy: "aiScore") → screen micro-cap tech
3. get_ticker_performance (symbol: <result>) → check historical return after signal
```

### Portfolio review

```
1. list_portfolio → see all open positions
2. get_prices (symbols: [<all open symbols>]) → current prices
3. get_ticker (symbol: <position>) → check if signal is still active
4. update_position (id: <id>, status: CLOSED, closePrice: <price>) → close a position
```

### Explore correlations

```
1. get_ticker_related (symbol: NVDA) → find co-occurring tickers
2. get_ticker_network (symbol: NVDA, minWeight: 3) → visualise the full correlation graph
```

### Track platform accuracy

```
1. get_portfolio_performance (days: "7") → platform win rate and average 7-day return
2. get_trending (sortBy: return, returnPeriod: 7d) → rank signals by 7-day performance
```

### Drill into a scan's raw signals

```
1. list_scans → get recent scan IDs
2. get_scan (scanId: <id>) → see all validated tickers for that scan
3. get_signals (scanId: <id>, stage: Consensus) → read the actual posts/filings that triggered detection
```

## Tips

- Symbol lookup is case-insensitive — `aapl` and `AAPL` both work
- `get_trending` with `stage: Consensus`, `trend: rising`, and `hidePnd: true` gives the cleanest signal list
- `generate_report` is cached — the first call generates the report, subsequent calls return instantly
- Performance data improves over time as more price snapshots accumulate (1d data arrives soonest)
- Use `get_ticker_related` before opening a position to check what else is moving in the same cluster
- `near52wLow: true` in `get_trending` surfaces potential mean-reversion setups alongside breakouts
- Use `get_signals` after `get_scan` to read the actual source content (post titles, filing descriptions) that triggered each ticker
- `get_portfolio_performance` shows `byScoreRange` (AI score) and `byOpportunityScoreRange` breakdowns — useful for calibrating which score thresholds historically predict returns

## Error Handling

All tools return JSON errors with an `error` field on failure:

| Status | Meaning |
|--------|---------|
| 400 | Bad request — check `details` for validation issues |
| 401 | Not authenticated — SIGNALSCOPE_API_KEY is missing or invalid |
| 402 | Payment required — set SIGNALSCOPE_WALLET_PRIVATE_KEY with USDC on Base, or use an API key |
| 404 | Ticker or resource not found |
| 500 | Server error |
