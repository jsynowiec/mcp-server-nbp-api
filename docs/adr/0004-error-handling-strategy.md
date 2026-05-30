# ADR 0004: All expected errors returned as tool results, never thrown

## Context

MCP has protocol-level JSON-RPC errors and tool-level `{ isError: true }` results. We also considered whether to proactively surface rate limit information.

## Decision

All expected failures (400, 401, 404, 429, 5xx, network errors) are caught in tool handlers and returned as `{ isError: true }`. Nothing throws through to the protocol layer. 400s include validation details, 429s explain rate limit exhaustion.

Rate limits are NOT proactively surfaced — most requests hit the cache, so headers from previous API calls would be stale.

## Consequences

- The LLM always gets a response it can reason about, even on errors
- Rate limit exhaustion is only visible when it actually occurs
