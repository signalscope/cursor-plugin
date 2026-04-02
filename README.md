# SignalScope — Cursor Plugin

> AI-powered stock breakout signal detection inside Cursor IDE

[![Cursor Marketplace](https://img.shields.io/badge/Cursor-Marketplace-blue)](https://cursor.com/marketplace)
[![npm](https://img.shields.io/npm/v/signalscope-mcp)](https://www.npmjs.com/package/signalscope-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SignalScope gives Cursor AI agents direct access to stock breakout signals via MCP tools. Query trending tickers, deep-dive with AI-generated reports and trade setups, track your portfolio and watchlist — all without leaving the IDE. Signals are aggregated from social media, SEC filings, congressional trades, options flow, and volume spikes, then scored and filtered for pump-and-dump patterns.

## What is SignalScope?

SignalScope aggregates signals from social media, SEC filings, congressional trades, options flow, volume spikes, and Polymarket. It scores candidates with AI, filters pump-and-dump patterns, and surfaces validated tickers with **opportunityScore** (early-mover rank) and **aiScore** (evidence confidence).

## Installation

Install from the [Cursor Marketplace](https://cursor.com/marketplace) by searching for **SignalScope**.

After installation, configure authentication (pick one):

**Option A — API key** (subscription required):
1. Open Cursor Settings → **Features** → **Model Context Protocol**
2. Find the `signalscope` server and click the gear icon
3. Set `SIGNALSCOPE_API_KEY` to your key

To get your API key:
1. Create an account at [signalscopes.com](https://signalscopes.com)
2. Go to your [Profile page](https://signalscopes.com/profile)
3. Click **Generate API Key** and copy it (shown only once)

**Option B — x402 pay-per-call** (no subscription needed):
1. Set `SIGNALSCOPE_WALLET_PRIVATE_KEY` to an Ethereum wallet private key with USDC on Base
2. Each API call deducts a small USDC amount automatically (e.g. $0.005–$0.05 per call)
3. No account or registration required

> **Note:** `search_tickers`, `get_methodology`, `list_scans`, `get_scan`, `get_signals`, and `get_platform_stats` are public (no key). Monetized ticker endpoints need an API key (subscriber) or x402. **`generate_report` cannot be generated with an API key** — use x402 ($0.05) or sign in on the site (Pro to generate new reports; cached reports may be returned for subscribers).

## Manual Installation (without Marketplace)

Add this to your Cursor MCP settings (`.cursor/mcp.json` or via Settings → MCP):

```json
{
  "mcpServers": {
    "signalscope": {
      "command": "npx",
      "args": ["-y", "signalscope-mcp"],
      "env": {
        "SIGNALSCOPE_API_KEY": "sk_sig_your_key_here"
      }
    }
  }
}
```

For x402 pay-per-call, replace `SIGNALSCOPE_API_KEY` with:
```json
"SIGNALSCOPE_WALLET_PRIVATE_KEY": "your_ethereum_private_key"
```

## Available Tools

### Discovery (free — no API key)

| Tool | Description |
|------|-------------|
| `search_tickers` | Search by symbol or partial name — up to 8 results with aiScore, opportunityScore, stage, and price |
| `get_methodology` | Platform methodology and scoring pipeline details |

### Signal Data

| Tool | Description |
|------|-------------|
| `get_trending` | Trending breakout tickers with filtering by stage, trend, market cap, sector, source — x402: $0.01 |
| `get_ticker` | Latest validated data + raw signals for a symbol — x402: $0.005 |
| `get_ticker_history` | Historical scan appearances (full list, no pagination) — x402: $0.005 |
| `get_ticker_performance` | Price performance — 1d, 3d, 7d, 30d returns since signal detection — x402: $0.005 |
| `get_ticker_related` | Scan co-occurrence candidates ranked by Pearson price correlation — x402: $0.005 |
| `get_ticker_network` | Price-correlation graph (`minCorrelation` 0–1); nodes seeded by co-occurrence or trending — x402: $0.01 |
| `generate_report` | AI report + trade setup — **x402 $0.05** or browser session (not via `x-api-key`) |
| `list_scans` | List recent harvest scans (public) |
| `get_scan` | One scan with validated tickers (public) |
| `get_signals` | Raw signals for a scan (public) |

### Portfolio

| Tool | Description |
|------|-------------|
| `list_portfolio` | All positions — open and closed |
| `add_position` | Open a new position |
| `update_position` | Update or close a position |
| `delete_position` | Delete a position |
| `get_portfolio_performance` | Platform-wide performance stats — win rate, avg return by AI score range and weekly cohort |

### Watchlist

| Tool | Description |
|------|-------------|
| `list_watchlist` | Watchlist enriched with ticker data and performance |
| `add_to_watchlist` | Add a symbol |
| `remove_from_watchlist` | Remove a symbol |

### Utility

| Tool | Description |
|------|-------------|
| `get_prices` | Current prices for up to 50 symbols (5-min cache); auth optional |
| `get_platform_stats` | Scan count, signal sum, distinct ticker count (public, rate-limited) |

## Example Prompts

Once installed, try these prompts in Cursor Chat:

**Morning scan:**
> "Show me the top Consensus-stage breakout signals from SignalScope right now, rising trend only, hiding any P&D flagged ones."

**Deep dive:**
> "Get the full SignalScope report for NVDA including the AI trade setup."

**Portfolio check:**
> "List my SignalScope portfolio and get current prices for all open positions."

**Screen by sector:**
> "Find micro-cap technology tickers with 3+ appearances in SignalScope sorted by AI score."

**Correlation research:**
> "What tickers co-occur most with AMD in SignalScope signals?"

**Track platform accuracy:**
> "Show me the 7-day performance stats from SignalScope — win rate and average return."



## Links

- [signalscopes.com](https://signalscopes.com) — Platform
- [API Documentation](https://signalscopes.com/skill/) — Full API reference
- [Methodology](https://signalscopes.com/methodology) — How signals are scored
- [Changelog](https://signalscopes.com/changelog) — What's new

## License

MIT
