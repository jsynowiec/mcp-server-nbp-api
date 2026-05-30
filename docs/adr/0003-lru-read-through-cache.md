# ADR 0003: LRU read-through cache for all API responses

## Context

NBP publishes rates and gold prices once per business day (typically ~11:30 CET). Once a value is published for a date, it does not change. An LLM session frequently re-queries the same endpoint multiple times within a conversation; a short cache means only the first fetch pays the network cost. Currency lists change at most annually, so they can share the same TTL as everything else — no need for a separate long-TTL bucket.

## Decision

Use `lru-cache` for data: max 100 entries, 15-minute TTL. Cache keys are `path + sorted query params`.

All tools expose `skipCache: boolean` (default `false`) so the LLM can force a fresh reading. When `skipCache` is `true`, the client bypasses both the read and the write.

## Consequences

- All cache entries share the same 15-minute TTL — simple and sufficient given NBP's once-per-business-day publication cadence
- A `skipCache: true` request still hits the network even if a cached value is available; this is the only way an agent can observe freshly published rates after the previous 15-minute window
- A session that re-queries the same endpoint pays the network cost only on the first call within the TTL window
