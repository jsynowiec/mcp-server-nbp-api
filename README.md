# NBP API MCP Server

[![Sponsor][sponsor-badge]][sponsor]
[![License][license-badge]][license]

An MCP server that integrates the [NBP Web API](https://api.nbp.pl/en.html), enabling natural language interaction with the datasets published by the NBP.PL. Query the current and historic exchange rates of foreign currencies, and current and historic prices of gold calculated at NBP.

## Installing

### npx (Node.js)

```json
{
  "mcpServers": {
    "nbp-api": {
      "command": "npx",
      "args": ["-y", "@jsynowiec/mcp-server-nbp-api"]
    }
  }
}
```

### bunx (Bun)

```json
{
  "mcpServers": {
    "nbp-api": {
      "command": "bunx",
      "args": ["--bun", "@jsynowiec/mcp-server-nbp-api"]
    }
  }
}
```

### Local development

Build the project first, then point your MCP client at the local build output:

```json
{
  "mcpServers": {
    "nbp-api": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-nbp-api/dist/index.js"]
    }
  }
}
```

## Tools

### get_currency_rate

Get the exchange rate for a specific currency.

### get_exchange_table

Get a complete exchange rate table with all currencies.

### get_currency_rate_history

Get historical exchange rates for a currency within a date range.

### get_gold_price

Get the gold price in PLN per gram, either current or for a specific date.

### get_gold_price_history

Get historical gold prices within a date range.

## Resources

| URI                          | Description |
| ---------------------------- | ----------- |
| `nbp://meta/currency_tables` | Table type  |

Resources are cached for the session lifetime.

## Prompts

| Prompt                 | Description                            |
| ---------------------- | -------------------------------------- |
| `current_usd:pln_rate` | Check current USD to PLN exchange rate |

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0 or Node.js >= 22

### Setup

```bash
bun install
bun run build
```

### Scripts

```bash
bun run build       # Compile TypeScript
bun run lint        # Run ESLint
bun run typecheck   # Type-check without emitting
bun run test        # Run tests
bun run dev:test    # Run tests in watch mode
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Release

The `prepublishOnly` script automatically runs build, lint, type-check, and tests before `npm publish`:

```bash
npm publish --access public
```

## Disclaimer

This project is not affiliated with, endorsed by, or associated with [NBP](https://nbp.pl/) in any way. It is an independent, open-source integration built on the publicly available [NBP Web API](https://api.nbp.pl/en.html).

## License

Released under the [MIT License][license].

[license-badge]: https://img.shields.io/github/license/jsynowiec/mcp-server-nbp-api.svg
[license]: https://github.com/jsynowiec/mcp-server-nbp-api/blob/master/LICENSE
[sponsor-badge]: https://img.shields.io/badge/♥-Sponsor-fc0fb5.svg
[sponsor]: https://github.com/sponsors/jsynowiec
