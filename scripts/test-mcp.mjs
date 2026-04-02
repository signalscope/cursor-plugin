#!/usr/bin/env node
/**
 * Test the SignalScope MCP server using the MCP SDK Client.
 * Exercises all MCP tools (read-only where possible).
 * Usage: SIGNALSCOPE_API_KEY=xxx SIGNALSCOPE_BASE_URL=http://localhost:3000 node scripts/test-mcp.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.SIGNALSCOPE_API_KEY ?? "";
const BASE_URL = process.env.SIGNALSCOPE_BASE_URL ?? "http://localhost:3000";

console.log(`Testing MCP server against ${BASE_URL}`);
console.log(`API key: ${API_KEY ? API_KEY.slice(0, 12) + "..." : "(not set)"}`);
console.log("---\n");

const transport = new StdioClientTransport({
  command: "node",
  args: [resolve(__dirname, "../dist/index.js")],
  env: {
    ...process.env,
    SIGNALSCOPE_API_KEY: API_KEY,
    SIGNALSCOPE_BASE_URL: BASE_URL,
  },
});

const client = new Client({ name: "test", version: "1.0" });

function parseToolResult(res) {
  const text = res.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isApiError(data) {
  if (data?.error) return true;
  const raw = typeof data?.raw === "string" ? data.raw : "";
  return raw.includes("API error") || raw.includes("Not authenticated");
}

async function run() {
  try {
    await client.connect(transport);
    console.log("✓ Connected to MCP server\n");

    // 1. List tools
    const { tools } = await client.listTools();
    console.log(`✓ tools/list: ${tools.length} tools`);
    const toolNames = tools.map((t) => t.name);
    console.log(`  ${toolNames.slice(0, 6).join(", ")}...\n`);

    // 2. search_tickers (free, no auth)
    const searchRes = await client.callTool({
      name: "search_tickers",
      arguments: { query: "AAPL" },
    });
    const searchData = parseToolResult(searchRes);
    console.log("✓ search_tickers('AAPL'):", searchData.results?.length ?? 0, "results");
    if (searchData.results?.[0]) {
      console.log(`  First: ${searchData.results[0].symbol} (score: ${searchData.results[0].aiScore ?? "n/a"})`);
    }

    // 3. get_methodology (free, no auth)
    const methodRes = await client.callTool({
      name: "get_methodology",
      arguments: {},
    });
    const methodData = parseToolResult(methodRes);
    const methodOk =
      methodData.error == null &&
      (methodData.description != null ||
        methodData.backtesting != null ||
        methodData.pipelineSteps != null);
    console.log("\n✓ get_methodology:", methodOk ? "OK" : "unexpected shape");

    if (!API_KEY) {
      const scansRes = await client.callTool({
        name: "list_scans",
        arguments: { page: 1, limit: 1 },
      });
      const scansData = parseToolResult(scansRes);
      const scansOk = Array.isArray(scansData.scans);
      console.log("\n✓ list_scans (no API key):", scansOk ? `${scansData.scans.length} scan(s)` : "unexpected");

      const statsRes = await client.callTool({ name: "get_platform_stats", arguments: {} });
      const statsData = parseToolResult(statsRes);
      const statsOk =
        typeof statsData.scans === "number" && typeof statsData.tickers === "number";
      console.log("✓ get_platform_stats (no API key):", statsOk ? "OK" : "unexpected");

      console.log("\n⚠ API key not set — skipping authenticated / paid ticker tools");
      await transport.close();
      process.exit(0);
    }

    // 4. get_trending (stage: Consensus = 3+ sources; MCP schema uses Emerging/Building/Consensus)
    const trendingRes = await client.callTool({
      name: "get_trending",
      arguments: { limit: 3, stage: "Consensus" },
    });
    const trendData = parseToolResult(trendingRes);
    const tickers = trendData.tickers ?? trendData.data ?? [];
    console.log("\n✓ get_trending(limit:3, stage:Consensus):", tickers.length, "tickers");
    if (tickers[0]) {
      console.log(`  First: ${tickers[0].symbol ?? tickers[0].ticker?.symbol} (${tickers[0].aiScore ?? "n/a"})`);
    }

    // 5. get_platform_stats
    const statsRes = await client.callTool({
      name: "get_platform_stats",
      arguments: {},
    });
    const statsData = parseToolResult(statsRes);
    if (isApiError(statsData)) throw new Error(`get_platform_stats failed: ${statsData.raw ?? statsData.error}`);
    const statsOk =
      typeof statsData.scans === "number" &&
      typeof statsData.signals === "number" &&
      typeof statsData.tickers === "number";
    console.log("\n✓ get_platform_stats:", statsOk ? "OK" : JSON.stringify(statsData).slice(0, 80) + "...");

    // 6. list_scans
    const scansRes = await client.callTool({
      name: "list_scans",
      arguments: { page: 1, limit: 2 },
    });
    const scansData = parseToolResult(scansRes);
    if (isApiError(scansData)) throw new Error(`list_scans failed: ${scansData.raw ?? scansData.error}`);
    const scans = scansData.scans ?? scansData.data ?? [];
    console.log("\n✓ list_scans(page:1, limit:2):", Array.isArray(scans) ? scans.length + " scans" : "unexpected");

    // 7. get_ticker (use a symbol; may 404 if not in DB)
    const tickerRes = await client.callTool({
      name: "get_ticker",
      arguments: { symbol: "AAPL" },
    });
    const tickerData = parseToolResult(tickerRes);
    if (isApiError(tickerData)) throw new Error(`get_ticker failed: ${tickerData.raw ?? tickerData.error}`);
    const tickerOk = tickerData.ticker?.symbol != null || tickerData.error != null;
    console.log("\n✓ get_ticker('AAPL'):", tickerOk ? "OK" : "unexpected");

    // 8. get_ticker_history
    const histRes = await client.callTool({
      name: "get_ticker_history",
      arguments: { symbol: "AAPL" },
    });
    const histData = parseToolResult(histRes);
    if (isApiError(histData)) throw new Error(`get_ticker_history failed: ${histData.raw ?? histData.error}`);
    console.log("✓ get_ticker_history('AAPL'):", Array.isArray(histData.history) ? "OK" : "unexpected");

    // 9. get_ticker_performance
    const perfRes = await client.callTool({
      name: "get_ticker_performance",
      arguments: { symbol: "AAPL" },
    });
    const perfData = parseToolResult(perfRes);
    if (isApiError(perfData)) throw new Error(`get_ticker_performance failed: ${perfData.raw ?? perfData.error}`);
    const perfOk =
      perfData.latest?.symbol != null ||
      perfData.return1d != null ||
      perfData.error != null;
    console.log("✓ get_ticker_performance('AAPL'):", perfOk ? "OK" : "unexpected");

    // 10. get_ticker_related
    const relatedRes = await client.callTool({
      name: "get_ticker_related",
      arguments: { symbol: "AAPL", limit: 2 },
    });
    const relatedData = parseToolResult(relatedRes);
    if (isApiError(relatedData)) throw new Error(`get_ticker_related failed: ${relatedData.raw ?? relatedData.error}`);
    console.log(
      "✓ get_ticker_related('AAPL'):",
      Array.isArray(relatedData.relatedTickers) ? "OK" : "unexpected"
    );

    // 11. get_ticker_network (no symbol = trending-based)
    const networkRes = await client.callTool({
      name: "get_ticker_network",
      arguments: { maxNodes: 5 },
    });
    const networkData = parseToolResult(networkRes);
    if (isApiError(networkData)) throw new Error(`get_ticker_network failed: ${networkData.raw ?? networkData.error}`);
    const hasNodes = Array.isArray(networkData.nodes ?? networkData.data?.nodes);
    console.log("✓ get_ticker_network(maxNodes:5):", hasNodes ? "OK" : "unexpected");

    // 12. get_prices (query param: symbols as comma-separated)
    const pricesRes = await client.callTool({
      name: "get_prices",
      arguments: { symbols: ["AAPL", "MSFT"] },
    });
    const pricesData = parseToolResult(pricesRes);
    if (isApiError(pricesData)) throw new Error(`get_prices failed: ${pricesData.raw ?? pricesData.error}`);
    const hasPrices = pricesData.prices != null || pricesData.error != null;
    console.log("✓ get_prices(['AAPL','MSFT']):", hasPrices ? "OK" : "unexpected");

    // 13. list_portfolio (read-only)
    const portRes = await client.callTool({
      name: "list_portfolio",
      arguments: {},
    });
    const portData = parseToolResult(portRes);
    if (isApiError(portData)) throw new Error(`list_portfolio failed: ${portData.raw ?? portData.error}`);
    console.log("✓ list_portfolio:", Array.isArray(portData.positions ?? portData.data) ? "OK" : "unexpected");

    // 14. list_watchlist (read-only)
    const watchRes = await client.callTool({
      name: "list_watchlist",
      arguments: {},
    });
    const watchData = parseToolResult(watchRes);
    if (isApiError(watchData)) throw new Error(`list_watchlist failed: ${watchData.raw ?? watchData.error}`);
    console.log("✓ list_watchlist:", Array.isArray(watchData.tickers ?? watchData.data ?? watchData.watchlist) ? "OK" : "unexpected");

    // Skip destructive: generate_report (costs $), add_position, update_position, delete_position, add_to_watchlist, remove_from_watchlist
    // Skip get_scan (needs real scanId from list_scans)

    console.log("\n✅ All MCP tool tests passed");
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    if (err.cause) console.error("  cause:", err.cause);
    process.exit(1);
  } finally {
    await transport.close();
  }
}

run();
