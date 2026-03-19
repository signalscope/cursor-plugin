# SignalScope — Cursor Plugin

> AI-powered stock breakout signal detection inside Cursor IDE

[![Cursor Marketplace](https://img.shields.io/badge/Cursor-Marketplace-blue)](https://cursor.com/marketplace)
[![npm](https://img.shields.io/npm/v/signalscope-mcp)](https://www.npmjs.com/package/signalscope-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SignalScope gives Cursor AI agents direct access to stock breakout signals via MCP tools. Query trending tickers, deep-dive with AI-generated reports and trade setups, track your portfolio and watchlist — all without leaving the IDE. Signals are aggregated from social media, SEC filings, congressional trades, options flow, and volume spikes, then scored and filtered for pump-and-dump patterns.

## What is SignalScope?

SignalScope aggregates signals from social media, SEC filings, congressional trades, options flow, and volume spikes. It scores candidates with AI, filters pump-and-dump patterns, and surfaces validated tickers ranked by confidence and stage.

## Installation

Install from the [Cursor Marketplace](https://cursor.com/marketplace) by searching for **SignalScope**.

After installation, add your API key:

1. Open Cursor Settings → **Features** → **Model Context Protocol**
2. Find the `signalscope` server and click the gear icon
3. Set `SIGNALSCOPE_API_KEY` to your key

**Get your API key:**
1. Create an account at [signalscopes.com](https://signalscopes.com)
2. Go to your [Profile page](https://signalscopes.com/profile)
3. Click **Generate API Key** and copy it (shown only once)

> **Note:** `search_tickers` and `get_methodology` work without an API key. All other tools require one.

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

## Available Tools

### Discovery (free — no API key)

| Tool | Description |
|------|-------------|
| `search_tickers` | Search by symbol or partial name — up to 8 results with AI score, stage, and price |
| `get_methodology` | Platform methodology and scoring pipeline details |

### Signal Data

| Tool | Description |
|------|-------------|
| `get_trending` | Trending breakout tickers with filtering by stage, trend, market cap, sector, source |
| `get_ticker` | Latest validated data + raw signals for a symbol |
| `get_ticker_history` | Historical scan appearances |
| `get_ticker_performance` | Price performance — 1d, 3d, 7d, 30d returns since signal detection |
| `get_ticker_related` | Co-occurring tickers with Jaccard similarity scores |
| `get_ticker_network` | Co-occurrence network graph |
| `generate_report` | AI report + trade setup (entry range, stop loss, targets, risk/reward) |
| `list_scans` | List recent harvest scans |
| `get_scan` | Detail of a specific scan with all validated tickers |

### Portfolio

| Tool | Description |
|------|-------------|
| `list_portfolio` | All positions — open and closed |
| `add_position` | Open a new position |
| `update_position` | Update or close a position |
| `delete_position` | Delete a position |

### Watchlist

| Tool | Description |
|------|-------------|
| `list_watchlist` | Watchlist enriched with ticker data and performance |
| `add_to_watchlist` | Add a symbol |
| `remove_from_watchlist` | Remove a symbol |

### Utility

| Tool | Description |
|------|-------------|
| `get_prices` | Current prices for up to 50 symbols (5-min cache) |
| `get_platform_stats` | Platform-wide stats |

## Example Prompts

Once installed, try these prompts in Cursor Chat:

**Morning scan:**
> "Show me the top confirmed breakout signals from SignalScope right now, rising trend only, hiding any P&D flagged ones."

**Deep dive:**
> "Get the full SignalScope report for NVDA including the AI trade setup."

**Portfolio check:**
> "List my SignalScope portfolio and get current prices for all open positions."

**Screen by sector:**
> "Find micro-cap technology tickers with 3+ appearances in SignalScope sorted by AI score."

**Correlation research:**
> "What tickers co-occur most with AMD in SignalScope signals?"



## Links

- [signalscopes.com](https://signalscopes.com) — Platform
- [API Documentation](https://signalscopes.com/skill/) — Full API reference
- [Methodology](https://signalscopes.com/methodology) — How signals are scored
- [Changelog](https://signalscopes.com/changelog) — What's new

## License

MIT
