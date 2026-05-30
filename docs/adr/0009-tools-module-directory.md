# ADR 0009: Tools as a module directory

## Context

With 11 tools split across three domains (currency rates, exchange-table/transaction analysis, gold), a single flat `src/tools.ts` would be hard to navigate and would mix unrelated concerns. The TOON formatting helpers and date utilities also need a stable home that is independent of any single tool file.

## Decision

`src/tools/` is a module directory containing:

- `rates.ts` — 4 lookup tools: `list_currencies`, `get_exchange_rate`, `get_rate_history`, `compare_currencies`
- `exchange.ts` — 4 transaction/analysis tools: `get_exchange_table`, `get_bid_ask_rates`, `convert_currency`, `find_rate_extreme`
- `gold.ts` — 3 gold tools: `get_gold_price`, `get_gold_price_history`, `find_gold_price_extreme`
- `format.ts` — TOON formatting helpers (`formatHistoryResponse`, `formatExtremeResponse`, `formatRate`, `formatTable`, `formatGoldPrice`)
- `utils.ts` — date utilities and range chunking (`chunkDateRange`, `getWarsawToday`, `validateDate`)
- `index.ts` — re-exports `registerTools(server, client)` which calls each sub-module's register function

## Consequences

- Each file stays focused on one domain or concern
- Tests mirror the same split under `tests/tools/{rates,exchange,gold,utils}.test.ts`
- A new tool that does not fit cleanly into rates/exchange/gold forces a deliberate decision about which module owns it — there is no `misc.ts` escape hatch
