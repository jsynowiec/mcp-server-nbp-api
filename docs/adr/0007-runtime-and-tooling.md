# ADR 0007: Bun primary runtime, npx compatible, Node >= 22

## Context

The server needs to work via both `bunx` and `npx`. Bun is faster for development; the published package must work with standard Node.js.

## Decision

- Bun is the primary development runtime; `bun test` is the test runner
- Published package targets Node.js >= 22 (native `fetch`, top-level `await`, Web Streams)
- `#!/usr/bin/env node` shebang for npx compatibility
- ESM only, TypeScript 6, ES2023 target, `moduleResolution: bundler`
- `prepublishOnly`: build + lint + typecheck + tests

## Consequences

- Node >= 22 floor is set so we can rely on native `fetch` and modern language features without polyfills
- Development is fast (Bun startup, native TS in `bun test`)
- Using `moduleResolution: bundler` means TypeScript does not enforce `.js` extensions on relative imports, but we still write them so the emitted ESM works under Node's `nodenext` resolver at runtime
