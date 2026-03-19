#!/usr/bin/env node
/**
 * Test the SignalScope MCP server using the MCP SDK Client.
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

async function run() {
  try {
    await client.connect(transport);
    console.log("✓ Connected to MCP server\n");

    // 1. List tools
    const { tools } = await client.listTools();
    console.log(`✓ tools/list: ${tools.length} tools`);
    console.log(`  ${tools.slice(0, 5).map((t) => t.name).join(", ")}...`);

    // 2. search_tickers (free, no auth)
    const searchRes = await client.callTool({
      name: "search_tickers",
      arguments: { query: "AAPL" },
    });
    const searchText = searchRes.content?.[0]?.text ?? "";
    const searchData = JSON.parse(searchText);
    console.log("\n✓ search_tickers('AAPL'):", searchData.results?.length ?? 0, "results");
    if (searchData.results?.[0]) {
      console.log(`  First: ${searchData.results[0].symbol} (score: ${searchData.results[0].aiScore ?? "n/a"})`);
    }

    if (!API_KEY) {
      console.log("\n⚠ API key not set — skipping authenticated tools");
      await transport.close();
      process.exit(0);
    }

    // 3. get_trending
    const trendingRes = await client.callTool({
      name: "get_trending",
      arguments: { limit: 3, stage: "CONFIRMED" },
    });
    const trendText = trendingRes.content?.[0]?.text ?? "";
    const trendData = JSON.parse(trendText);
    const tickers = trendData.tickers ?? trendData.data ?? [];
    console.log("\n✓ get_trending(limit:3, stage:CONFIRMED):", tickers.length, "tickers");
    if (tickers[0]) {
      console.log(`  First: ${tickers[0].symbol ?? tickers[0].ticker?.symbol} (${tickers[0].aiScore ?? "n/a"})`);
    }

    // 4. get_methodology (free)
    const methodRes = await client.callTool({
      name: "get_methodology",
      arguments: {},
    });
    const methodText = methodRes.content?.[0]?.text ?? "";
    const methodData = JSON.parse(methodText);
    console.log("\n✓ get_methodology:", methodData.backtestDescription ? "OK" : JSON.stringify(methodData).slice(0, 80) + "...");

    // 5. get_platform_stats
    const statsRes = await client.callTool({
      name: "get_platform_stats",
      arguments: {},
    });
    const statsText = statsRes.content?.[0]?.text ?? "";
    const statsData = JSON.parse(statsText);
    console.log("\n✓ get_platform_stats:", JSON.stringify(statsData));

    console.log("\n✅ All tests passed");
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    process.exit(1);
  } finally {
    await transport.close();
  }
}

run();
