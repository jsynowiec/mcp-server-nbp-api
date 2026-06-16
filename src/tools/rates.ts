// ABOUTME: Registers the rate-lookup tools: list_currencies, get_exchange_rate,
// ABOUTME: get_rate_history, compare_currencies. All responses are TOON-encoded.

import type { NbpApiClient } from "#/nbp-api.js";
import { formatNbpApiError } from "#/tools/errors.js";
import {
  formatComparison,
  formatCurrencyList,
  formatHistoryResponse,
  formatRate,
} from "#/tools/format.js";
import { err, ok } from "#/tools/result.js";
import {
  currencyCodeSchema,
  midTableEnum,
  skipCacheSchema,
  tableEnum,
} from "#/tools/schemas.js";
import { computeHistoryStats } from "#/tools/stats.js";
import { checkDates, daysInclusive, round } from "#/tools/utils.js";
import type { TableType } from "#/types.js";
import { NbpApiError } from "#/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerRateTools(
  server: McpServer,
  client: NbpApiClient,
): void {
  server.registerTool(
    "list_currencies",
    {
      description:
        "List every currency available in an NBP exchange-rate table (A, B, or C). " +
        "Use this to discover valid currency codes before calling other rate tools.",
      inputSchema: {
        table: tableEnum
          .optional()
          .describe(
            "Exchange-rate table: A (mid rates, major currencies), B (mid rates, extended set), C (bid/ask, major currencies). Default: A.",
          ),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ table, skipCache }) => {
      const effectiveTable: TableType = table ?? "A";
      try {
        const currencies = await client.getCurrencies(effectiveTable, {
          skipCache: skipCache ?? false,
        });
        return ok(formatCurrencyList(currencies));
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "table",
              table: effectiveTable,
            }),
          );
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "get_exchange_rate",
    {
      description:
        "Get the current or historical mid exchange rate for a single currency against PLN. " +
        "Optionally convert an amount of that currency into PLN using the returned rate.",
      inputSchema: {
        currency: currencyCodeSchema.describe(
          "ISO 4217 currency code (e.g. 'USD', 'EUR'). Case-insensitive.",
        ),
        amount: z
          .number()
          .positive()
          .optional()
          .describe(
            "Optional amount in the foreign currency to convert to PLN using the returned mid rate.",
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Optional YYYY-MM-DD date (Europe/Warsaw). Omit for the most recent published rate.",
          ),
        table: midTableEnum
          .optional()
          .describe(
            "Mid-rate table: A (default, ~35 major currencies) or B (~130 currencies). Use list_currencies to check membership.",
          ),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currency, amount, date, table, skipCache }) => {
      const effectiveTable: TableType = table ?? "A";
      const upperCode = currency.toUpperCase();

      const dateError = checkDates([date, "date"]);
      if (dateError) return dateError;

      try {
        const rate = await client.getExchangeRate(
          effectiveTable,
          upperCode,
          date,
          { skipCache: skipCache ?? false },
        );
        const quote = rate.rates[0];
        if (!quote || quote.mid === undefined) {
          throw new NbpApiError(
            502,
            `empty rate payload for ${upperCode} on ${date ?? "the latest date"}`,
          );
        }
        const mid = quote.mid;
        return ok(
          formatRate({
            table: effectiveTable,
            code: rate.code,
            currency: rate.currency,
            mid,
            effectiveDate: quote.effectiveDate,
            ...(amount !== undefined
              ? { amount, plnValue: round(amount * mid, 4) }
              : {}),
          }),
        );
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "rate",
              table: effectiveTable,
              code: upperCode,
              date,
            }),
          );
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "get_rate_history",
    {
      description:
        "Get the historical mid exchange rate for a currency over a date range (up to 93 days). " +
        "Returns summary statistics (min, max, average, first-to-last percent change) and the full series. " +
        "For ranges longer than 93 days, use find_rate_extreme.",
      inputSchema: {
        currency: currencyCodeSchema.describe(
          "ISO 4217 currency code. Case-insensitive.",
        ),
        start_date: z
          .string()
          .describe("Range start date (YYYY-MM-DD, Europe/Warsaw)."),
        end_date: z
          .string()
          .describe("Range end date (YYYY-MM-DD, Europe/Warsaw)."),
        table: midTableEnum
          .optional()
          .describe("Mid-rate table: A (default) or B."),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currency, start_date, end_date, table, skipCache }) => {
      const effectiveTable: TableType = table ?? "A";
      const upperCode = currency.toUpperCase();

      const dateError = checkDates(
        [start_date, "start_date"],
        [end_date, "end_date"],
      );
      if (dateError) return dateError;

      if (start_date > end_date) {
        return err(
          `start_date '${start_date}' must be on or before end_date '${end_date}'.`,
        );
      }

      const span = daysInclusive(start_date, end_date);
      if (span > 93) {
        return err(
          `Date range of ${span} days exceeds the 93-day limit. Use find_rate_extreme for ranges over 93 days (up to 366 days).`,
        );
      }

      try {
        const history = await client.getExchangeRateHistory(
          effectiveTable,
          upperCode,
          start_date,
          end_date,
          { skipCache: skipCache ?? false },
        );

        const series = history.rates
          .filter((q): q is typeof q & { mid: number } => q.mid !== undefined)
          .map((q) => ({ date: q.effectiveDate, mid: q.mid }));

        if (series.length === 0) {
          return err(
            `No NBP data in the range ${start_date} → ${end_date} for ${upperCode}. NBP publishes on business days only.`,
          );
        }

        const stats = computeHistoryStats(
          series.map((p) => ({ date: p.date, value: p.mid })),
        );
        return ok(formatHistoryResponse(stats, { rates: series }));
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "rate",
              table: effectiveTable,
              code: upperCode,
              rangeStart: start_date,
              rangeEnd: end_date,
            }),
          );
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "compare_currencies",
    {
      description:
        "Compare the current (or historical) mid rates of multiple currencies against PLN in a single call. " +
        "Returns a TOON table sorted by rate, plus a note listing any requested codes not present in the chosen table.",
      inputSchema: {
        currencies: z
          .array(currencyCodeSchema)
          .min(1, "at least 1 currency code is required")
          .max(10, "at most 10 currency codes are allowed")
          .describe(
            "Between 1 and 10 ISO 4217 currency codes (case-insensitive).",
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Optional YYYY-MM-DD date. Omit for the most recent published rates.",
          ),
        table: midTableEnum
          .optional()
          .describe("Mid-rate table: A (default) or B."),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currencies, date, table, skipCache }) => {
      const effectiveTable: TableType = table ?? "A";
      const requested = currencies.map((c) => c.toUpperCase());

      const dateError = checkDates([date, "date"]);
      if (dateError) return dateError;

      try {
        const snapshot = await client.getExchangeTable(effectiveTable, date, {
          skipCache: skipCache ?? false,
        });

        const matchedByCode = new Map<
          string,
          { code: string; currency: string; mid: number }
        >();
        for (const rate of snapshot.rates) {
          if (rate.mid !== undefined && requested.includes(rate.code)) {
            matchedByCode.set(rate.code, {
              code: rate.code,
              currency: rate.currency,
              mid: rate.mid,
            });
          }
        }

        const matched = [...matchedByCode.values()].sort(
          (a, b) => a.mid - b.mid,
        );
        const missing = requested.filter((c) => !matchedByCode.has(c));

        if (matched.length === 0) {
          return err(
            `None of the requested codes were found in Table ${effectiveTable}: ${requested.join(", ")}. Use list_currencies to see available codes.`,
          );
        }

        return ok(
          formatComparison({
            table: snapshot.table,
            effectiveDate: snapshot.effectiveDate,
            rows: matched,
            ...(missing.length > 0 ? { missing } : {}),
          }),
        );
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "table",
              table: effectiveTable,
              date,
            }),
          );
        }
        throw e;
      }
    },
  );
}
