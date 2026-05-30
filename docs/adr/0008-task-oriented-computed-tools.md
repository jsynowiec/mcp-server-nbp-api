# ADR 0008: Task-oriented, computed tools

## Context

The NBP Web API offers a small set of REST endpoints (exchange table, single rate, rate range, gold price, gold range). A naïve MCP server would expose one tool per endpoint, leaving the agent to chain multiple calls and perform its own arithmetic (currency conversion, finding the min/max in a range that exceeds the 93-day API limit, computing spreads). That pattern wastes tokens on intermediate results and invites arithmetic mistakes.

The reference Python server (`mpryc/nbp-mcp-server`) takes the thin-wrapper approach. The goal here is a server that answers agent-level questions directly.

## Decision

Tools are designed around the questions an agent is likely to ask, not around the underlying endpoints. The server exposes computed tools that fan out to the API client, perform the arithmetic, and return a single answer:

- `convert_currency` — fetches both legs (or one leg if PLN is involved), computes the cross-rate, returns the answer
- `find_rate_extreme` / `find_gold_price_extreme` — auto-split ranges that exceed the 93-day API limit (up to a hard cap of 366 days), fetch sequentially, return the global min/max
- `get_rate_history` / `get_gold_price_history` — return summary statistics (min, max, average, first-to-last % change) alongside the raw series
- `compare_currencies` — fetches the full exchange table once and filters to the requested codes, sorting by rate

Response encoding uses the `@toon-format/toon` npm package; we do not maintain a custom TOON implementation.

## Consequences

- Tool implementations do more work (fan-out fetches, arithmetic), while the API client surface stays narrow and unchanged
- The agent saves round trips and avoids arithmetic on serialised numbers
- A tool that fans out to multiple API calls fails entirely if any leg fails (`isError: true` with no partial results) — agents need not reason about partial state
