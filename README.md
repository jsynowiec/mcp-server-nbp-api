# NBP Api MCP Server

[![Sponsor][sponsor-badge]][sponsor]
[![License][license-badge]][license]

An MCP server that integrates the [Narodowy Bank Polski (NBP) Web API](https://api.nbp.pl/en.html), enabling natural language interaction with the datasets published by the NBP. Query current and historic exchange rates (mid rates and bid/ask spreads), gold prices, convert between currencies, compare currencies side-by-side, and analyse rate trends over time.

## Example

> ### 🧑‍💻 User
>
> Compare the latest gold price to its recent average over 30 days.
>
> ### 🤖 Assistant
>
> Here's the comparison between the latest NBP gold price and its 30‑day average:
>
> | Metric                                    | Value                    |
> | ----------------------------------------- | ------------------------ |
> | **Latest price** (29 May 2026)            | **514.16 PLN/g**         |
> | **30‑day average** (29 Apr – 29 May 2026) | **536.18 PLN/g**         |
> | Difference vs. average                    | **–22.02 PLN/g (–4.1%)** |
>
> The current gold price is **4.1% below** the 30‑day average. It's actually the lowest close in the entire period — the 30‑day range ran from 514.16 (today) up to a peak of 549.04 on 14 May. So gold has softened noticeably over the past couple of weeks after touching that high in mid‑May.

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

## Conventions

- Currency codes follow ISO 4217 (three uppercase letters, e.g. `USD`, `EUR`, `GBP`). The server accepts both cases and uppercases internally.
- Dates follow ISO 8601 calendar form (`YYYY-MM-DD`) and are interpreted in `Europe/Warsaw`. NBP publishes on Polish business days only, typically around 11:30 CET.
- All tool responses are formatted as [TOON](https://toonformat.dev/) for token efficiency. Error responses are returned as `isError: true` tool results, never as exceptions.

## Tools

Tables A and B contain mid rates (A is the major-currency table, B is the extended set updated weekly). Table C contains bid/ask quotes for a smaller set of major currencies.

### Rate tools

| Tool                 | Parameters                                                                     | Description                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_currencies`    | `table?` (A\|B\|C, default A), `skipCache?`                                    | List every currency code present in the chosen table.                                                                                              |
| `get_exchange_rate`  | `currency`, `amount?`, `date?`, `table?` (A\|B, default A), `skipCache?`       | Mid rate for one currency vs. PLN, optionally for a past date. With `amount`, also returns the PLN value.                                          |
| `get_rate_history`   | `currency`, `start_date`, `end_date`, `table?` (A\|B, default A), `skipCache?` | Daily mid-rate series plus stats (min, max, average, first-to-last percent change). Range capped at 93 days — use `find_rate_extreme` beyond that. |
| `compare_currencies` | `currencies` (1–10 codes), `date?`, `table?` (A\|B, default A), `skipCache?`   | Snapshot comparison of several currencies sorted by mid rate, with a note listing any codes missing from the table.                                |

### Exchange tools

| Tool                 | Parameters                                                                                                                | Description                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `get_exchange_table` | `table?` (A\|B\|C, default A), `date?`, `skipCache?`                                                                      | Full exchange-rate table snapshot (mid for A/B, bid/ask for C).                                                                       |
| `get_bid_ask_rates`  | `currency`, `amount?`, `date?`, `skipCache?`                                                                              | Table C bid/ask quotes and the implied spread; if a currency is missing from C, the error message points back at `get_exchange_rate`. |
| `convert_currency`   | `amount`, `from`, `to`, `date?`, `table?` (A\|B, default A), `skipCache?`                                                 | PLN-anchored conversion. Same-currency calls return `1:1` without a fetch; cross-currency uses two parallel rate fetches via PLN.     |
| `find_rate_extreme`  | `currency`, `start_date`, `end_date`, `extreme?` (min\|max\|both, default both), `table?` (A\|B, default A), `skipCache?` | Min/max search over windows up to 366 days. Auto-splits into ≤93-day chunks. Returns `dataPoints` but no daily series.                |

### Gold tools

| Tool                      | Parameters                                                                        | Description                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `get_gold_price`          | `date?`, `amount_grams?`, `skipCache?`                                            | NBP gold price in PLN per gram. With `amount_grams`, also returns total PLN.                             |
| `get_gold_price_history`  | `start_date`, `end_date`, `skipCache?`                                            | Daily gold-price series plus stats. Range capped at 93 days — use `find_gold_price_extreme` beyond that. |
| `find_gold_price_extreme` | `start_date`, `end_date`, `extreme?` (min\|max\|both, default both), `skipCache?` | Min/max search over windows up to 366 days. Same auto-split behaviour as `find_rate_extreme`.            |

## Resources

| URI                   | MIME               | Description                                                                                  |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `nbp://currencies/A`  | `application/json` | JSON array of `{code, name}` for every currency in Table A.                                  |
| `nbp://currencies/B`  | `application/json` | JSON array of `{code, name}` for every currency in Table B.                                  |
| `nbp://currencies/C`  | `application/json` | JSON array of `{code, name}` for every currency in Table C.                                  |
| `nbp://meta/tables`   | `text/plain`       | Overview of the three tables, what each contains, and when to use them.                      |
| `nbp://meta/schedule` | `text/plain`       | Publication schedule, business-day caveats, data-availability start dates, and range limits. |

Currency-list resources share the API client's LRU cache (100 entries, 15 minutes) with `get_exchange_table`.

## Prompts

| Prompt                 | Arguments                                         | Description                                                                                                                            |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `forex_assistant`      | `currency`, `amount?`                             | Look up the current PLN rate, optionally convert an amount, contextualise against the past 30 days.                                    |
| `rate_trend_analysis`  | `currency`, `period?` (30d\|90d\|1y, default 30d) | Analyse the trend over the window. Uses `get_rate_history` for ≤90d and `find_rate_extreme` for 1y.                                    |
| `gold_price_research`  | `period?` (30d\|90d, default 30d)                 | Compare the latest gold price to its recent average over the chosen window.                                                            |
| `transaction_planning` | `currency`, `amount`                              | Estimate realistic transaction cost using Table C bid/ask vs. the mid-rate reference and report the spread in PLN and as a percentage. |

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
bun run fmtcheck    # Check Prettier formatting
bun run format      # Apply Prettier formatting
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
