@README.md
@.agents/AGENTS.local.md

## Architecture Decisions

Documented in [docs/adr/](docs/adr/README.md). When a significant architectural decision is made with the user during a session, add a new ADR and update the index. When a plan includes an ADR, it must be the first task executed so it guides the implementation.

@docs/adr/README.md

## Conventions

- SDK: `@modelcontextprotocol/sdk` v1 (deep imports: `@modelcontextprotocol/sdk/server/mcp.js`)
- Schema validation: Zod v3, `.describe()` on every field
- Tool names: snake_case
- All logging to stderr (never stdout — that's the STDIO transport)
- ESM only, `.js` extensions in imports

## Testing

- Mock `globalThis.fetch` in API client tests, `InMemoryTransport.createLinkedPair()` for tool/resource/prompt tests
- No real API calls in tests
- `createServer()` in `src/server.ts` wires everything without connecting a transport — tests import it directly, `src/index.ts` is a pure CLI runner
