#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL =
  process.env.SIGNALSCOPE_BASE_URL ?? "https://signalscopes.com";
const API_KEY = process.env.SIGNALSCOPE_API_KEY ?? "";
const WALLET_PRIVATE_KEY = process.env.SIGNALSCOPE_WALLET_PRIVATE_KEY ?? "";

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

// Replaced with x402-aware fetch at startup when SIGNALSCOPE_WALLET_PRIVATE_KEY is set
let activeFetch: typeof globalThis.fetch = globalThis.fetch;

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await activeFetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as Record<string, unknown>).error)
        : `HTTP ${res.status}`;

    if (res.status === 402) {
      // Parse price from x402 payment requirements if available
      const accepts =
        typeof data === "object" && data !== null && "accepts" in data
          ? (data as Record<string, unknown>).accepts
          : null;
      const priceInfo =
        Array.isArray(accepts) && accepts[0]
          ? ` (price: ${(accepts[0] as Record<string, unknown>).maxAmountRequired ?? "unknown"} USDC on Base)`
          : "";
      const reportHint = path.includes("/report")
        ? " POST /api/tickers/.../report is not available with API key alone — use x402 or the website. "
        : "";
      throw new Error(
        `SignalScope API error: payment required${priceInfo}. ${reportHint}` +
          `Set SIGNALSCOPE_API_KEY (subscription at signalscopes.com/profile) or ` +
          `SIGNALSCOPE_WALLET_PRIVATE_KEY with USDC on Base for pay-per-call via x402.`
      );
    }

    throw new Error(`SignalScope API error: ${msg}`);
  }

  return data;
}

function toText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "signalscope",
  version: "1.2.0",
});

// ---------------------------------------------------------------------------
// Discovery tools (free — no API key required)
// ---------------------------------------------------------------------------

server.tool(
  "search_tickers",
  "Search SignalScope tickers by symbol or partial name. Free endpoint — no API key required. Returns up to 8 matches with aiScore, opportunityScore (null if not yet validated), stage, and price.",
  {
    query: z
      .string()
      .min(1)
      .max(20)
      .describe("Ticker symbol or partial name to search for (e.g. 'AAPL', 'NV', 'micro')"),
  },
  async ({ query }) => {
    const data = await apiFetch(`/api/search${buildQueryString({ q: query })}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_methodology",
  "Get the SignalScope platform methodology — how signals are harvested, scored, filtered, and staged. Free endpoint — no API key required.",
  {},
  async () => {
    const data = await apiFetch("/api/methodology");
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Signal data tools (API key or x402 required)
// ---------------------------------------------------------------------------

server.tool(
  "get_trending",
  "Get trending breakout tickers — symbols appearing in 2+ scans within the last 30 days, with aiScore, opportunityScore, performance, and trend (rising/falling/stable from score history). Paid: API key (subscriber) or x402 ($0.01). summary.avgScore is mean aiScore only.",
  {
    page: z.number().int().min(1).default(1).optional().describe("Page number (default: 1)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .describe("Results per page (default: 20, max: 100)"),
    minAppearances: z
      .number()
      .int()
      .min(2)
      .default(2)
      .optional()
      .describe("Minimum scan appearances (default: 2)"),
    stage: z
      .enum(["Emerging", "Building", "Consensus"])
      .optional()
      .describe("Filter by signal stage: Emerging (1 source), Building (2 sources), Consensus (3+ sources)"),
    trend: z
      .enum(["rising", "falling", "stable"])
      .optional()
      .describe("Filter by trend direction based on AI score history"),
    sector: z.string().optional().describe("Filter by sector (e.g. 'Technology', 'Healthcare')"),
    marketCap: z
      .enum(["micro", "small", "mid", "large"])
      .optional()
      .describe("Filter by market cap: micro (<$300M), small ($300M-$2B), mid ($2B-$10B), large (>$10B)"),
    sortBy: z
      .enum(["appearances", "aiScore", "opportunityScore", "price", "return", "marketCap"])
      .default("appearances")
      .optional()
      .describe("Sort order (default: appearances)"),
    source: z
      .enum([
        "REDDIT",
        "TWITTER",
        "STOCKTWITS",
        "SEC_INSIDER",
        "CONGRESS",
        "VOLUME_SPIKE",
        "OPTIONS_FLOW",
        "POLYMARKET",
      ])
      .optional()
      .describe("Filter by signal source"),
    hidePnd: z
      .boolean()
      .default(false)
      .optional()
      .describe("Hide pump-and-dump flagged tickers (default: false)"),
    returnPeriod: z
      .enum(["1d", "3d", "7d", "30d"])
      .default("7d")
      .optional()
      .describe("Return period for sorting/display (default: 7d)"),
    near52wLow: z
      .boolean()
      .default(false)
      .optional()
      .describe("Only show tickers trading near their 52-week low"),
  },
  async (params) => {
    const qs = buildQueryString(params as Record<string, string | number | boolean | undefined>);
    const data = await apiFetch(`/api/tickers/trending${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_ticker",
  "Get the latest validated ticker row plus raw signals. Includes opportunityScore (early-mover rank) and aiScore (evidence confidence — not expected returns), stage, fundamentals, P&D fields, cached report fields if present, and signals[]. Paid: API key or x402 ($0.005).",
  {
    symbol: z
      .string()
      .min(1)
      .max(10)
      .describe("Ticker symbol (e.g. 'AAPL', 'TSLA') — case-insensitive"),
  },
  async ({ symbol }) => {
    const data = await apiFetch(`/api/tickers/${encodeURIComponent(symbol.toUpperCase())}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_ticker_history",
  "Get historical scan appearances for a ticker (up to ~90 completed scans), ordered by scan time. Each row: scanId, startedAt, aiScore, stage, price, signalCount, sourceCount, recommendation. No server-side pagination — the API returns the full list. Paid: API key or x402 ($0.005).",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol"),
  },
  async ({ symbol }) => {
    const data = await apiFetch(
      `/api/tickers/${encodeURIComponent(symbol.toUpperCase())}/history`
    );
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_ticker_performance",
  "Get price performance data for a ticker — 1-day, 3-day, 7-day, and 30-day returns tracked from the time of signal detection. Requires API key or x402 payment ($0.005).",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol"),
  },
  async ({ symbol }) => {
    const data = await apiFetch(
      `/api/tickers/${encodeURIComponent(symbol.toUpperCase())}/performance`
    );
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_ticker_related",
  "Co-occurring scan symbols ranked by Pearson price correlation vs target (correlationScore). latestAiScore is AI confidence only; use get_ticker for opportunityScore. API key or x402 ($0.005).",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol"),
    page: z.number().int().min(1).default(1).optional().describe("Page number (default: 1)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .describe("Results per page (default: 20)"),
    minCoOccurrences: z
      .number()
      .int()
      .min(1)
      .default(2)
      .optional()
      .describe("Minimum co-occurrence count (default: 2)"),
    days: z
      .number()
      .int()
      .min(1)
      .max(90)
      .default(30)
      .optional()
      .describe("Lookback window in days (default: 30)"),
    stage: z
      .enum(["Emerging", "Building", "Consensus"])
      .optional()
      .describe("Filter related tickers by stage"),
  },
  async ({ symbol, ...params }) => {
    const qs = buildQueryString(params as Record<string, string | number | boolean | undefined>);
    const data = await apiFetch(
      `/api/tickers/${encodeURIComponent(symbol.toUpperCase())}/related${qs}`
    );
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_ticker_network",
  "Price-correlation graph: nodes from co-occurrence or top trending; edges above minCorrelation (0–1). Omit symbol for trending-based graph. API key or x402 ($0.01).",
  {
    symbol: z
      .string()
      .min(1)
      .max(10)
      .optional()
      .describe("Center the network on this symbol (optional — omit for trending-based network)"),
    minCorrelation: z
      .number()
      .min(0)
      .max(1)
      .default(0.3)
      .optional()
      .describe("Minimum absolute correlation (0–1) for an edge (default: 0.3)"),
    stage: z
      .enum(["Emerging", "Building", "Consensus"])
      .optional()
      .describe("Filter nodes by signal stage"),
    days: z
      .number()
      .int()
      .min(1)
      .max(90)
      .default(30)
      .optional()
      .describe("Lookback window in days (default: 30)"),
    maxNodes: z
      .number()
      .int()
      .min(2)
      .max(50)
      .default(30)
      .optional()
      .describe("Maximum nodes (default: 30, min: 2, max: 50)"),
  },
  async (params) => {
    const qs = buildQueryString(params as Record<string, string | number | boolean | undefined>);
    const data = await apiFetch(`/api/tickers/network${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "generate_report",
  "AI report + trade setup. Not available via x-api-key (403). Use x402 ($0.05) or website; Pro to generate new reports; cached may load when signed in. POST.",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol"),
  },
  async ({ symbol }) => {
    const data = await apiFetch(
      `/api/tickers/${encodeURIComponent(symbol.toUpperCase())}/report`,
      { method: "POST" }
    );
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "list_scans",
  "List harvest scans (paginated). Public. Paid ticker routes still need API key or x402.",
  {
    page: z.number().int().min(1).default(1).optional().describe("Page number (default: 1)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .describe("Results per page (default: 20)"),
  },
  async ({ page, limit }) => {
    const qs = buildQueryString({ page, limit });
    const data = await apiFetch(`/api/scans${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_scan",
  "One scan with validated tickers (aiScore desc, opportunityScore tiebreak). Public.",
  {
    scanId: z.string().describe("Scan ID (from list_scans)"),
    includeFiltered: z
      .boolean()
      .default(false)
      .optional()
      .describe("Include pump-and-dump flagged (FILTERED) tickers (default: false)"),
  },
  async ({ scanId, includeFiltered }) => {
    const qs = buildQueryString({ includeFiltered });
    const data = await apiFetch(`/api/scans/${encodeURIComponent(scanId)}${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_signals",
  "Raw signals for a scan (max 200), by source count then velocity. Public.",
  {
    scanId: z.string().describe("Scan ID (from list_scans)"),
    stage: z
      .enum(["Emerging", "Building", "Consensus", "Filtered"])
      .optional()
      .describe("Filter signals to tickers at this stage only"),
  },
  async ({ scanId, stage }) => {
    const qs = buildQueryString({ scanId, stage });
    const data = await apiFetch(`/api/signals${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Portfolio tools (API key required)
// ---------------------------------------------------------------------------

server.tool(
  "list_portfolio",
  "List all portfolio positions for the authenticated user — open and closed positions with entry price, shares, notes, and P&L. Requires API key.",
  {},
  async () => {
    const data = await apiFetch("/api/portfolio");
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "add_position",
  "Add a new position to the portfolio. Requires API key.",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol (e.g. 'AAPL')"),
    entryPrice: z.number().positive().describe("Entry price per share"),
    shares: z.number().positive().optional().describe("Number of shares (optional)"),
    notes: z.string().max(500).optional().describe("Optional notes about the trade"),
  },
  async ({ symbol, entryPrice, shares, notes }) => {
    const data = await apiFetch("/api/portfolio", {
      method: "POST",
      body: { symbol: symbol.toUpperCase(), entryPrice, shares, notes },
    });
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "update_position",
  "Update position: notes, entryPrice, shares, or close (status CLOSED + closePrice). API key required.",
  {
    id: z.string().describe("Position ID (from list_portfolio)"),
    status: z.enum(["OPEN", "CLOSED"]).optional().describe("Set to 'CLOSED' to close the position"),
    closePrice: z
      .number()
      .positive()
      .optional()
      .describe("Close price per share — required when status is 'CLOSED'"),
    entryPrice: z.number().positive().optional().describe("Updated entry price per share"),
    shares: z.number().positive().optional().describe("Updated share count"),
    notes: z.string().max(500).optional().describe("Updated notes"),
  },
  async ({ id, status, closePrice, entryPrice, shares, notes }) => {
    const data = await apiFetch(`/api/portfolio/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status, closePrice, entryPrice, shares, notes },
    });
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "delete_position",
  "Permanently delete a portfolio position. This action cannot be undone. Requires API key.",
  {
    id: z.string().describe("Position ID (from list_portfolio)"),
  },
  async ({ id }) => {
    const data = await apiFetch(`/api/portfolio/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_portfolio_performance",
  "Get platform-wide portfolio performance statistics — win rate, average return, and median return across all tracked positions, broken down by AI score range, opportunity score range, and weekly cohorts. Requires API key.",
  {
    days: z
      .enum(["1", "3", "7", "30"])
      .default("7")
      .optional()
      .describe("Return horizon in days: 1, 3, 7, or 30 (default: 7)"),
  },
  async ({ days }) => {
    const qs = buildQueryString({ days });
    const data = await apiFetch(`/api/performance${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Watchlist tools (API key required)
// ---------------------------------------------------------------------------

server.tool(
  "list_watchlist",
  "List all watchlist items for the authenticated user, enriched with latest ticker data, signal stage, AI score, and performance metrics. Requires API key.",
  {},
  async () => {
    const data = await apiFetch("/api/watchlist/tickers");
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "add_to_watchlist",
  "Add a ticker symbol to the watchlist. Idempotent — safe to call even if already on watchlist. Requires API key.",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol to add (e.g. 'TSLA')"),
  },
  async ({ symbol }) => {
    const data = await apiFetch("/api/watchlist", {
      method: "POST",
      body: { symbol: symbol.toUpperCase() },
    });
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "remove_from_watchlist",
  "Remove a ticker symbol from the watchlist. Requires API key.",
  {
    symbol: z.string().min(1).max(10).describe("Ticker symbol to remove"),
  },
  async ({ symbol }) => {
    const data = await apiFetch(
      `/api/watchlist/${encodeURIComponent(symbol.toUpperCase())}`,
      { method: "DELETE" }
    );
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Utility tools (API key required)
// ---------------------------------------------------------------------------

server.tool(
  "get_prices",
  "Current prices for up to 50 symbols (5-minute cache). Auth optional.",
  {
    symbols: z
      .array(z.string().min(1).max(10))
      .min(1)
      .max(50)
      .describe("Array of ticker symbols (e.g. ['AAPL', 'TSLA', 'NVDA'])"),
  },
  async ({ symbols }) => {
    const qs = buildQueryString({ symbols: symbols.map((s) => s.toUpperCase()).join(",") });
    const data = await apiFetch(`/api/prices${qs}`);
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

server.tool(
  "get_platform_stats",
  "Platform stats: completed scans, summed signal counts, distinct validated tickers. Public (rate-limited).",
  {},
  async () => {
    const data = await apiFetch("/api/stats");
    return { content: [{ type: "text", text: toText(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  // Set up x402 pay-per-call if wallet private key is provided
  if (WALLET_PRIVATE_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ wrapFetchWithPayment, x402Client }, { registerExactEvmScheme }, { privateKeyToAccount }] =
        (await Promise.all([
          import("@x402/fetch"),
          import("@x402/evm/exact/client"),
          import("viem/accounts"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ])) as any[];

      const pk = (
        WALLET_PRIVATE_KEY.startsWith("0x") ? WALLET_PRIVATE_KEY : `0x${WALLET_PRIVATE_KEY}`
      ) as `0x${string}`;
      const account = privateKeyToAccount(pk);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new x402Client();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerExactEvmScheme(client, { signer: account as any });
      activeFetch = wrapFetchWithPayment(
        globalThis.fetch,
        client
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
      process.stderr.write(
        `[signalscope-mcp] x402 pay-per-call enabled (wallet: ${account.address})\n`
      );
    } catch (err) {
      process.stderr.write(
        `[signalscope-mcp] Warning: Failed to set up x402 payment client: ${err}\n` +
          `  Ensure @x402/fetch, @x402/evm, and viem are installed (npm install @x402/fetch @x402/evm viem).\n`
      );
    }
  }

  if (!API_KEY && !WALLET_PRIVATE_KEY) {
    process.stderr.write(
      "[signalscope-mcp] Warning: No auth configured. " +
        "Public tools: search_tickers, get_methodology, list_scans, get_scan, get_signals, get_platform_stats. " +
        "Paid ticker tools need API key or x402 wallet.\n" +
        "  • SIGNALSCOPE_API_KEY — signalscopes.com/profile (subscription)\n" +
        "  • SIGNALSCOPE_WALLET_PRIVATE_KEY — USDC on Base (x402)\n"
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[signalscope-mcp] Server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[signalscope-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
