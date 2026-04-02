# Changelog

## 1.2.0 — 2026-04-03

### Fixed

- Restored correct MCP tool names for several tools (a bad edit had registered long descriptions as names, breaking clients).
- `get_ticker_network` now sends `minCorrelation` (0–1) instead of ignored `minWeight`; `maxNodes` minimum set to 2 to match the API.
- `get_ticker_history` no longer sends ignored `page`/`limit` query params.

### Added

- Trending filter `source`: `POLYMARKET`.
- `update_position`: `entryPrice` and `shares` in PATCH body.
- Explicit `zod` dependency.
- Test script checks for `list_scans` / `get_platform_stats` without an API key.

### Docs

- Tool descriptions and README / bundled skill aligned with SignalScope APIs: public scans/signals/stats, `generate_report` vs API key, opportunity vs AI score, related/network correlation behavior.

## 1.1.0 and earlier

See git history.
