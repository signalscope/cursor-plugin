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

SignalScope is a stock breakout signal detection platform. It harvests signals from Reddit, X/Twitter, StockTwits, SEC insider filings, congressional trades, options flow, volume spikes, and Polymarket — scores them with AI, filters pump-and-dump candidates, and surfaces validated tickers with **opportunityScore** (early-mover / setup rank) and **aiScore** (evidence confidence, not expected returns).

**Base URL:** `https://signalscopes.com`

## Authentication

Two auth methods — configure one in the MCP server environment:

**API key** (`SIGNALSCOPE_API_KEY`): Requires a SignalScope subscription. Generate at signalscopes.com/profile. Flat monthly/yearly rate with full access and a daily API request quota.

**x402 pay-per-call** (`SIGNALSCOPE_WALLET_PRIVATE_KEY`): No account or subscription needed. Set an Ethereum wallet private key with USDC on Base. Each call deducts a small amount automatically ($0.005–$0.05 depending on endpoint). Costs are per-request only — no fixed fees.

**No API key or wallet** (public / free): `search_tickers`, `get_methodology`, `list_scans`, `get_scan`, `get_signals`, `get_platform_stats`. **Paid ticker endpoints** need a subscriber API key or x402 (`get_trending`, `get_ticker`, history, performance, related, network). **`generate_report` rejects `x-api-key`** — use x402 or the website (Pro to generate; cached reports may load for logged-in users).

## Key Concepts

- **Scan**: A complete harvest run across all sources, producing a set of validated tickers
- **Signal stage**: How confirmed a breakout signal is (Emerging → Building → Consensus)
  - `Emerging` — detected from 1 source
  - `Building` — detected from 2 sources
  - `Consensus` — detected from 3+ sources
  - `Filtered` — flagged as potential pump-and-dump (hidden by default)
- **AI Score (`aiScore`)**: 0–100 evidence strength — not a proxy for forward returns
- **Opportunity Score (`opportunityScore`)**: 0–100 early-mover / setup quality; scan lists prioritize this
- **Trending**: Tickers appearing in 2+ scans within 30 days, with trend direction (rising/falling/stable)
- **P&D flags**: 11 statistical pump-and-dump detection flags; tickers with 3+ flags are staged as FILTERED
- **Trade setup**: AI-generated entry range, stop loss, targets, timeframe, and risk/reward ratio — available for Buy/Strong Buy recommendations

## Available MCP Tools

### Discovery (free — no API key)

| Tool | Description |
|------|-------------|
| `search_tickers` | Search — up to 8 results with aiScore, opportunityScore (null if not validated), stage, price |
| `get_methodology` | Platform methodology and scoring pipeline details |

### Signal Data

Ticker deep-dives need a **subscriber API key** or **x402**. Scan listing endpoints are public.

| Tool | x402 cost | Description |
|------|-----------|-------------|
| `get_trending` | $0.01 | Trending breakout tickers with rich filtering (stage, trend, market cap, sector, source, etc.) |
| `get_ticker` | $0.005 | Latest validated data + raw signals for a symbol |
| `get_ticker_history` | $0.005 | Full history of scan appearances (no query pagination; API returns up to ~90 rows) |
| `get_ticker_performance` | $0.005 | Price performance — 1d, 3d, 7d, 30d returns since signal detection |
| `get_ticker_related` | $0.005 | Co-occurring symbols ranked by Pearson **price** correlation vs target |
| `get_ticker_network` | $0.01 | **Price-correlation** graph; use `minCorrelation` (0–1); optional center `symbol` |
| `generate_report` | $0.05 | AI report + trade setup — **not** via API key; x402 or web session |
| `list_scans` | public | List recent harvest scans |
| `get_scan` | public | Scan detail with validated tickers |
| `get_signals` | public | Raw signals for a scan |

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

### Utility

| Tool | Description |
|------|-------------|
| `get_prices` | Current prices for up to 50 symbols (5-min cache); auth optional |
| `get_platform_stats` | Public — completed scans, summed signals, distinct validated tickers |

## Common Workflows

### Morning signal scan

```
1. get_trending (stage: Consensus, trend: rising, hidePnd: true) → find the strongest Consensus-stage breakouts
2. get_ticker (symbol: <top result>) → deep-dive the leading candidate
3. generate_report (symbol: <top result>) → AI thesis + trade setup **only with x402 wallet configured** (API key alone returns 403 for this endpoint)
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
2. get_ticker_network (symbol: NVDA, minCorrelation: 0.25) → price-correlation graph with more edges
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
| 402 | Payment required — set SIGNALSCOPE_WALLET_PRIVATE_KEY with USDC on Base, or use an API key for paid ticker routes |
| 403 | Forbidden — e.g. `generate_report` with API key only, or subscription required for new report generation in browser |
| 404 | Ticker or resource not found |
| 500 | Server error |
