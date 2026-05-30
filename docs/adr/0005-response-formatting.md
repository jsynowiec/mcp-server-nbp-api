# ADR 0005: TOON responses, JSON used programatically

## Context

MCP should be token-efficient. TOON (Token-Oriented Object Notation) encodes structured data more compactly than JSON while remaining LLM-readable, and is closer to a Markdown table than a serialised object. Plain-text responses lose structure entirely and force the agent to re-parse strings.

## Decision

JSON is used programmatically inside the codebase, and encoded as [TOON](https://toonformat.dev/reference/spec.html) at the response boundary via the `@toon-format/toon` npm package. All TOON encoding is centralised in `src/tools/format.ts` — tool handlers never write raw TOON strings.

## Consequences

- Significantly fewer tokens than raw JSON
- Single point of change if the response shape evolves: `src/tools/format.ts`
- A new dependency (`@toon-format/toon`) on a pre-1.x ecosystem; if the package were to disappear, we would need to vendor or replace the encoder
