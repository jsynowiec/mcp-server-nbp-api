# ADR 0001: Use MCP SDK v1 stable

## Context

This server exposes the NBP Web API to LLM agents over MCP. The SDK version chosen determines import paths, the schema validation library, and protocol compatibility with downstream clients.

The MCP TypeScript SDK has v1 stable (`@modelcontextprotocol/sdk`, Zod v3) and v2 alpha (`@modelcontextprotocol/server`, Zod v4). The v2 alpha has a cleaner API but no production adoption yet.

## Decision

Use SDK v1 stable (`^1.29.0`) with Zod v3 (`^3.25.0`). Migrate to v2 when it reaches stable.

## Consequences

- Deep import paths required (e.g., `@modelcontextprotocol/sdk/server/mcp.js`)
- Zod v3 for schemas, even though SDK 1.29 accepts both v3 and v4
- Migration to v2 will require updating imports and potentially Zod version
