# ADR 0005: TOON responses, JSON used programatically

## Context

MCP should be token-efficient.

## Decision

JSON is used programmatically, and is encode as [TOON](https://github.com/toon-format/toon) right before the response.

## Consequences

- Significantly fewer tokens than raw JSON
