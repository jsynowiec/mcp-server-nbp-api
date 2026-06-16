// ABOUTME: Registers the exchange tools: get_exchange_table, get_bid_ask_rates,
// ABOUTME: convert_currency, find_rate_extreme. Last one auto-splits the 93-day NBP limit.

import type { NbpApiClient } from "#/nbp-api.js";
import { formatNbpApiError } from "#/tools/errors.js";
import {
  FIND_EXTREME_MAX_DAYS,
  runExtremeFinder,
} from "#/tools/extreme-finder.js";
import { formatBidAsk, formatConversion, formatTable } from "#/tools/format.js";
import { err, ok } from "#/tools/result.js";
import {
  currencyCodeSchema,
  extremeEnum,
  midTableEnum,
  skipCacheSchema,
  tableEnum,
} from "#/tools/schemas.js";
import { checkDates, round } from "#/tools/utils.js";
import type { TableType } from "#/types.js";
import { NbpApiError } from "#/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerExchangeTools(
  server: McpServer,
  client: NbpApiClient,
): void {
  server.registerTool(
    "get_exchange_table",
    {
      description:
        "Get the full NBP exchange-rate table for a given date (or the most recent published one). " +
        "Tables A and B return mid rates; Table C returns bid/ask quotes.",
      inputSchema: {
        table: tableEnum
          .optional()
          .describe(
            "Exchange-rate table: A (default, mid rates, major currencies), B (mid rates, extended set), or C (bid/ask, major currencies).",
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Optional YYYY-MM-DD date (Europe/Warsaw). Omit for the latest published table.",
          ),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ table, date, skipCache }) => {
      const effectiveTable: TableType = table ?? "A";

      const dateError = checkDates([date, "date"]);
      if (dateError) return dateError;

      try {
        const snapshot = await client.getExchangeTable(effectiveTable, date, {
          skipCache: skipCache ?? false,
        });

        const rows =
          effectiveTable === "C"
            ? snapshot.rates
                .filter(
                  (r): r is typeof r & { bid: number; ask: number } =>
                    r.bid !== undefined && r.ask !== undefined,
                )
                .map((r) => ({
                  code: r.code,
                  currency: r.currency,
                  bid: r.bid,
                  ask: r.ask,
                }))
            : snapshot.rates
                .filter(
                  (r): r is typeof r & { mid: number } => r.mid !== undefined,
                )
                .map((r) => ({
                  code: r.code,
                  currency: r.currency,
                  mid: r.mid,
                }));

        return ok(
          formatTable({
            table: snapshot.table,
            effectiveDate: snapshot.effectiveDate,
            rows,
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

  server.registerTool(
    "get_bid_ask_rates",
    {
      description:
        "Get the NBP bid (buy) and ask (sell) rates and spread for a currency from Table C. " +
        "Table C has significantly fewer currencies than A or B; for currencies not in C, use get_exchange_rate.",
      inputSchema: {
        currency: currencyCodeSchema.describe(
          "ISO 4217 currency code (case-insensitive).",
        ),
        amount: z
          .number()
          .positive()
          .optional()
          .describe(
            "Optional amount to multiply by bid and ask, returning total PLN.",
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Optional YYYY-MM-DD date. Omit for the latest published quote.",
          ),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currency, amount, date, skipCache }) => {
      const upperCode = currency.toUpperCase();

      const dateError = checkDates([date, "date"]);
      if (dateError) return dateError;

      try {
        const rate = await client.getExchangeRate("C", upperCode, date, {
          skipCache: skipCache ?? false,
        });
        const quote = rate.rates[0];
        if (!quote || quote.bid === undefined || quote.ask === undefined) {
          throw new NbpApiError(
            502,
            `empty bid/ask payload for ${upperCode} on ${date ?? "the latest date"}`,
          );
        }
        const bid = quote.bid;
        const ask = quote.ask;
        return ok(
          formatBidAsk({
            table: "C",
            code: rate.code,
            currency: rate.currency,
            bid,
            ask,
            spread: round(ask - bid, 4),
            effectiveDate: quote.effectiveDate,
            ...(amount !== undefined
              ? {
                  amount,
                  totalBuyPln: round(amount * bid, 4),
                  totalSellPln: round(amount * ask, 4),
                }
              : {}),
          }),
        );
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "rate",
              table: "C",
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
    "convert_currency",
    {
      description:
        "Convert an amount between two currencies using NBP mid rates. " +
        "Supports any direction: foreign↔PLN or cross-currency (foreign↔foreign via PLN). " +
        "Returns the reference mid rate — use get_bid_ask_rates for actual bank transaction rates.",
      inputSchema: {
        amount: z
          .number()
          .positive()
          .describe("Positive amount in from_currency to convert."),
        from_currency: currencyCodeSchema.describe(
          "Source ISO 4217 currency code, or 'PLN' (case-insensitive).",
        ),
        to_currency: currencyCodeSchema.describe(
          "Target ISO 4217 currency code, or 'PLN' (case-insensitive).",
        ),
        date: z
          .string()
          .optional()
          .describe(
            "Optional YYYY-MM-DD date. Omit for the latest published rates.",
          ),
        table: midTableEnum
          .optional()
          .describe(
            "Mid-rate table: A (default) or B. Table B covers ~130 currencies.",
          ),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ amount, from_currency, to_currency, date, table, skipCache }) => {
      const from = from_currency.toUpperCase();
      const to = to_currency.toUpperCase();
      const effectiveTable: TableType = table ?? "A";

      const dateError = checkDates([date, "date"]);
      if (dateError) return dateError;

      if (from === to) {
        return ok(
          formatConversion({
            amount,
            from,
            to,
            rate: 1,
            result: amount,
            effectiveDate: null,
          }),
        );
      }

      const opts = { skipCache: skipCache ?? false };
      const note =
        "Reference mid rate — use get_bid_ask_rates for actual bank transaction rates.";
      const codeForError =
        from === "PLN" ? to : to === "PLN" ? from : `${from}/${to}`;

      try {
        if (from === "PLN") {
          const rate = await client.getExchangeRate(
            effectiveTable,
            to,
            date,
            opts,
          );
          const quote = rate.rates[0];
          if (!quote || quote.mid === undefined) {
            return err(`No NBP mid rate available for ${to}.`);
          }
          const roundedRate = round(1 / quote.mid, 6);
          return ok(
            formatConversion({
              amount,
              from: "PLN",
              to,
              rate: roundedRate,
              result: round(amount * roundedRate, 4),
              effectiveDate: quote.effectiveDate,
              note,
            }),
          );
        }

        if (to === "PLN") {
          const rate = await client.getExchangeRate(
            effectiveTable,
            from,
            date,
            opts,
          );
          const quote = rate.rates[0];
          if (!quote || quote.mid === undefined) {
            return err(`No NBP mid rate available for ${from}.`);
          }
          const roundedRate = round(quote.mid, 6);
          return ok(
            formatConversion({
              amount,
              from,
              to: "PLN",
              rate: roundedRate,
              result: round(amount * roundedRate, 4),
              effectiveDate: quote.effectiveDate,
              note,
            }),
          );
        }

        const [sourceRate, targetRate] = await Promise.all([
          client.getExchangeRate(effectiveTable, from, date, opts),
          client.getExchangeRate(effectiveTable, to, date, opts),
        ]);
        const sourceQuote = sourceRate.rates[0];
        const targetQuote = targetRate.rates[0];
        if (
          !sourceQuote ||
          sourceQuote.mid === undefined ||
          !targetQuote ||
          targetQuote.mid === undefined
        ) {
          return err(`No NBP mid rate available for ${from} or ${to}.`);
        }
        const sourceMid = sourceQuote.mid;
        const targetMid = targetQuote.mid;
        const roundedRate = round(sourceMid / targetMid, 6);
        return ok(
          formatConversion({
            amount,
            from,
            to,
            rate: roundedRate,
            result: round(amount * roundedRate, 4),
            effectiveDate: sourceQuote.effectiveDate,
            sourceMid: round(sourceMid, 6),
            targetMid: round(targetMid, 6),
            note,
          }),
        );
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "rate",
              table: effectiveTable,
              code: codeForError,
              date,
            }),
          );
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "find_rate_extreme",
    {
      description:
        `Find the min and/or max mid rate for a currency over a date range up to ${FIND_EXTREME_MAX_DAYS} days. ` +
        "Auto-splits the range into ≤93-day chunks (the NBP single-query limit) and aggregates results.",
      inputSchema: {
        currency: currencyCodeSchema.describe(
          "ISO 4217 currency code (case-insensitive).",
        ),
        start_date: z
          .string()
          .describe("Range start date (YYYY-MM-DD, Europe/Warsaw)."),
        end_date: z
          .string()
          .describe("Range end date (YYYY-MM-DD, Europe/Warsaw)."),
        extreme: extremeEnum
          .optional()
          .describe(
            "Which extreme to compute: 'min', 'max', or 'both' (default).",
          ),
        table: midTableEnum
          .optional()
          .describe("Mid-rate table: A (default) or B."),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currency, start_date, end_date, extreme, table, skipCache }) => {
      const upperCode = currency.toUpperCase();
      const effectiveTable: TableType = table ?? "A";
      const opts = { skipCache: skipCache ?? false };

      return runExtremeFinder({
        startDate: start_date,
        endDate: end_date,
        mode: extreme ?? "both",
        fetchChunk: async (chunkStart, chunkEnd) => {
          const history = await client.getExchangeRateHistory(
            effectiveTable,
            upperCode,
            chunkStart,
            chunkEnd,
            opts,
          );
          return history.rates
            .filter((q): q is typeof q & { mid: number } => q.mid !== undefined)
            .map((q) => ({ date: q.effectiveDate, value: q.mid }));
        },
        errorContext: {
          resource: "rate",
          table: effectiveTable,
          code: upperCode,
        },
        emptyMessage: `No NBP data in the range ${start_date} → ${end_date} for ${upperCode}. NBP publishes on business days only.`,
      });
    },
  );
}
