@README.md
@.agents/AGENTS.local.md

## Architecture Decisions

Documented in [docs/adr/](docs/adr/README.md). When a significant architectural decision is made with the user during a session, add a new ADR and update the index. When a plan includes an ADR, it must be the first task executed so it guides the implementation.

@docs/adr/README.md

## Conventions

- Use `@/` path alias for TypeScript imports of app modules
- SDK: `@modelcontextprotocol/sdk` v1 (deep imports: `@modelcontextprotocol/sdk/server/mcp.js`)
- Schema validation: Zod v3, `.describe()` on every field
- Tool names: snake_case
- All logging to stderr (never stdout — that's the STDIO transport)
- ESM only, `.js` extensions in imports

## Testing

- Mock `globalThis.fetch` in API client tests, `InMemoryTransport.createLinkedPair()` for tool/resource/prompt tests
- No real API calls in tests
- `createServer()` in `src/server.ts` wires everything without connecting a transport — tests import it directly, `src/index.ts` is a pure CLI runner

## Completion Checks

When finishing work, run the linter and format checks:

```sh
bun run lint
bun run fmtcheck
bun run typecheck
```

## NBP API gotchas

- NBP publishes rates and gold prices on business days only (Mon–Fri, excluding Polish public holidays). A 404 on a weekend or holiday date is expected, not an error in the server.
- Rates are typically published around 11:30 CET. Querying today before publication returns 404 — the error message should suggest omitting the date to get the most recent available value.
- Exchange-rate data starts 2002-01-02. Gold price data starts 2013-01-02 (about 11 years later).
- Table C (bid/ask) has significantly fewer currencies than Tables A or B (mid rates only). Never silently fall back from C to A — return an error suggesting `get_exchange_rate` for the mid rate.
- The NBP API rejects range queries over 93 days with HTTP 400. `get_rate_history` and `get_gold_price_history` enforce this and point the agent to `find_rate_extreme` / `find_gold_price_extreme` for longer windows. The extreme-finders auto-split up to a hard cap of 366 days.
- "Future" means future in `Europe/Warsaw` time, not UTC. Use `getWarsawToday()` from `src/tools/utils.ts` for any date-validation comparison — `new Date()` will be wrong for clients in the Americas after Warsaw midnight.
