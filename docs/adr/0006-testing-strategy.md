# ADR 0006: Mocked fetch and InMemoryTransport, no real API calls

## Decision

Two test levels, both fully mocked:

1. **API client tests** — mock `globalThis.fetch`, verify URL construction, headers, error mapping, cache behavior.
2. **Integration tests** — use `InMemoryTransport.createLinkedPair()` to test tools/resources/prompts through the full MCP protocol with mocked fetch.

Manual testing with the MCP Inspector against the real API during development.

## Consequences

- Tests run in milliseconds, no network dependency
- Real API edge cases are only caught during manual testing
