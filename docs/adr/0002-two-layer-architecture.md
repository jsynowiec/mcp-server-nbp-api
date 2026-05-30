# ADR 0002: Two-layer architecture (tools + API client)

## Context

Keeping MCP registration code separate from the HTTP client lets the API client be tested without the MCP protocol overhead, and lets each layer evolve without churning the other.

## Decision

`src/tools/` (module directory), `src/resources.ts`, and `src/prompts.ts` handle MCP registration and response formatting. `src/nbp-api.ts` is a typed API client handling HTTP, caching, and error mapping. `src/server.ts` exports `createServer()` (no config — NBP API is public) that wires everything together and returns a wired `McpServer` without connecting a transport, enabling test-time wiring. `src/index.ts` is the CLI runner that connects the STDIO transport.

`src/tools/` contains domain-grouped sub-modules:

- `rates.ts` — lookup tools (`list_currencies`, `get_exchange_rate`, `get_rate_history`, `compare_currencies`)
- `exchange.ts` — transaction and analysis tools (`get_exchange_table`, `get_bid_ask_rates`, `convert_currency`, `find_rate_extreme`)
- `gold.ts` — gold price tools (`get_gold_price`, `get_gold_price_history`, `find_gold_price_extreme`)
- `format.ts` — TOON formatting helpers
- `utils.ts` — date utilities and range chunking
- `index.ts` — re-exports `registerTools(server, client)`

## Consequences

- API client is testable without MCP protocol overhead
- Test directory mirrors `src/` structure: `src/__tests__/tools/{rates,exchange,gold,utils}.test.ts`
- Format helpers live in `src/tools/format.ts`; tool handlers never write raw TOON strings
- `createServer()` takes no configuration parameter since the NBP API requires no authentication
