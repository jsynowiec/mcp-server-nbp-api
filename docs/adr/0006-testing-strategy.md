# ADR 0006: Mocked fetch and InMemoryTransport, no real API calls

## Context

The NBP API is public, read-only, and deterministic per date — once a value is published for a date, it does not change. This means mocked-fetch tests are sufficient to cover correctness of URL construction, error mapping, and cache behavior; we do not need recorded HTTP fixtures or contract tests against the live API. Real-API edge cases (404 on holidays, weekend behavior, freshly published data) are covered by manual exercise through the MCP Inspector during development.

## Decision

Two test levels, both fully mocked:

1. **API client tests** — mock `globalThis.fetch`, verify URL construction, headers, error mapping, cache behavior.
2. **Integration tests** — use `InMemoryTransport.createLinkedPair()` to test tools/resources/prompts through the full MCP protocol with mocked fetch.

Manual testing with the MCP Inspector against the real API during development.

## Consequences

- Tests run in milliseconds, no network dependency
- Real API edge cases are only caught during manual testing
