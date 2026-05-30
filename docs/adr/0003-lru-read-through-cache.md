# ADR 0003: LRU read-through cache for all API responses

## Decision

Use `lru-cache` for data: max 100 entries, 15-minute TTL. Cache keys are `path + sorted query params`.

All tools expose `skipCache: boolean` (default `false`) so the LLM can force a fresh reading.
