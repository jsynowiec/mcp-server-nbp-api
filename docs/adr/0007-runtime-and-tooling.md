# ADR 0007: Bun primary runtime, npx compatible, Node >= 22

## Context

The server needs to work via both `bunx` and `npx`. Bun is faster for development; the published package must work with standard Node.js.

## Decision

- Bun is the primary development runtime
- Published package targets Node.js >= 22 (native `fetch`, JSON import assertions)
- `#!/usr/bin/env node` shebang for npx compatibility
- ESM only, TypeScript 5.9, ES2022 target, NodeNext module resolution
- Pre-commit hooks: lint + typecheck (not tests)
- `prepublishOnly`: build + lint + typecheck + tests

## Consequences

- Node >= 22 floor is set by JSON import assertions (`with { type: 'json' }`)
- Development is fast (Bun startup, native TS in vitest)
