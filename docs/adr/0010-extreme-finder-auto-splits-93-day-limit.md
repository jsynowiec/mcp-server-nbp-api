# ADR 0010: `find_*_extreme` tools auto-split the 93-day API limit

## Context

The NBP Web API rejects exchange-rate and gold-price range requests over 93 days with HTTP 400. Agents asking for the year's min/max would otherwise have to perform the chunking themselves and merge the results.

## Decision

`find_rate_extreme` and `find_gold_price_extreme` accept caller-supplied ranges up to a hard cap of 366 days. The implementation splits the range into ≤93-day chunks (via `chunkDateRange` in `src/tools/utils.ts`), fans out requests sequentially, and returns the global min/max.

If any chunk fails, the tool returns `{ isError: true }` with no partial results.

All other history tools (`get_rate_history`, `get_gold_price_history`) enforce the 93-day limit and return an error pointing the agent to the extreme-finder tools when the range exceeds it.

## Consequences

- Extreme-finder tools make up to 4 sequential API calls per invocation
- Agents get a single result regardless of range length, with no partial-state reasoning
- The 366-day hard cap exists so a malformed call (e.g., a 10-year range) cannot trigger many sequential network calls; ranges over a year are explicitly out of scope for these tools
