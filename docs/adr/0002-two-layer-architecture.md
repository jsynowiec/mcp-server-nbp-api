# ADR 0002: Two-layer architecture (tools + API client)

## Decision

`tools.ts`, `resources.ts`, and `prompts.ts` handle MCP registration and response formatting. `nbp-api.ts` is a typed API client handling HTTP, caching, and error mapping. `index.ts` wires them together and exports `createServer(config)` for test use (returns a wired McpServer without connecting a transport).

## Consequences

- API client is testable without MCP protocol overhead
- If tool count grows, the flat files can be split into domain-grouped modules without changing the client layer
