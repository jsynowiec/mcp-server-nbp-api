# Architecture Decision Records

| ADR                                     | Decision                                                   |
| --------------------------------------- | ---------------------------------------------------------- |
| [0001](0001-sdk-version.md)             | Use MCP SDK v1 stable, migrate to v2 when stable           |
| [0002](0002-two-layer-architecture.md)  | Two-layer architecture: MCP registrations + API client     |
| [0003](0003-lru-read-through-cache.md)  | LRU read-through cache with 15min TTL, 100 max entries     |
| [0004](0004-error-handling-strategy.md) | All expected errors returned as tool results, never thrown |
| [0005](0005-response-formatting.md)     | TOON responses, JSON used programatically                  |
| [0006](0006-testing-strategy.md)        | Mocked fetch and InMemoryTransport, no real API calls      |
| [0007](0007-runtime-and-tooling.md)     | Bun primary, npx compatible, Node >= 22                    |
| [0008](0008-task-oriented-computed-tools.md) | Task-oriented, computed tools (not API mirrors)       |
| [0009](0009-tools-module-directory.md)  | `src/tools/` is a module directory grouped by domain       |
| [0010](0010-extreme-finder-auto-splits-93-day-limit.md) | `find_*_extreme` tools auto-split the 93-day API limit |
