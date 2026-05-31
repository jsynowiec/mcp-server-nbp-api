// ABOUTME: Registers the gold tools: get_gold_price, get_gold_price_history,
// ABOUTME: find_gold_price_extreme. The extreme tool auto-splits the 93-day NBP limit.

import type { NbpApiClient } from "#/nbp-api.js";
import { formatNbpApiError } from "#/tools/errors.js";
import {
  FIND_EXTREME_MAX_DAYS,
  runExtremeFinder,
} from "#/tools/extreme-finder.js";
import {
  formatGoldPrice,
  formatHistoryResponse,
  type GoldSeriesPoint,
} from "#/tools/format.js";
import { err, ok } from "#/tools/result.js";
import { extremeEnum, skipCacheSchema } from "#/tools/schemas.js";
import { computeHistoryStats } from "#/tools/stats.js";
import { checkDates, daysInclusive, round } from "#/tools/utils.js";
import { NbpApiError } from "#/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerGoldTools(
  server: McpServer,
  client: NbpApiClient,
): void {
  server.registerTool(
    "get_gold_price",
    {
      description:
        "Get the NBP gold price in PLN per gram of 1000-fine gold, current or for a specific date. " +
        "Optionally returns the total PLN value for a given mass.",
      inputSchema: {
        amount_grams: z
          .number()
          .positive()
          .optional()
          .describe(
            "Optional mass in grams. When provided, returns total PLN value (price × grams).",
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Optional YYYY-MM-DD date (Europe/Warsaw). Omit for the latest published price.",
          ),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ amount_grams, date, skipCache }) => {
      const dateError = checkDates([date, "date"]);
      if (dateError) return dateError;

      try {
        const price = await client.getGoldPrice(date, {
          skipCache: skipCache ?? false,
        });
        return ok(
          formatGoldPrice({
            date: price.date,
            pricePerGram: price.price,
            ...(amount_grams !== undefined
              ? {
                  amountGrams: amount_grams,
                  totalPln: round(amount_grams * price.price, 4),
                }
              : {}),
          }),
        );
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(formatNbpApiError(e, { resource: "gold", date }));
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "get_gold_price_history",
    {
      description:
        "Get NBP gold prices over a date range (up to 93 days). " +
        "Returns summary statistics (min, max, average, first-to-last percent change) and the full series. " +
        "For ranges longer than 93 days, use find_gold_price_extreme.",
      inputSchema: {
        start_date: z
          .string()
          .describe("Range start date (YYYY-MM-DD, Europe/Warsaw)."),
        end_date: z
          .string()
          .describe("Range end date (YYYY-MM-DD, Europe/Warsaw)."),
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ start_date, end_date, skipCache }) => {
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
          `Date range of ${span} days exceeds the 93-day limit. Use find_gold_price_extreme for ranges over 93 days (up to 366 days).`,
        );
      }

      try {
        const points = await client.getGoldPriceHistory(start_date, end_date, {
          skipCache: skipCache ?? false,
        });

        const series: GoldSeriesPoint[] = points.map((p) => ({
          date: p.date,
          price: p.price,
        }));

        if (series.length === 0) {
          return err(
            `No NBP gold data in the range ${start_date} → ${end_date}. NBP publishes on business days only.`,
          );
        }

        const stats = computeHistoryStats(
          series.map((p) => ({ date: p.date, value: p.price })),
        );
        return ok(formatHistoryResponse(stats, { prices: series }));
      } catch (e) {
        if (e instanceof NbpApiError) {
          return err(
            formatNbpApiError(e, {
              resource: "gold",
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
    "find_gold_price_extreme",
    {
      description:
        `Find the min and/or max NBP gold price over a date range up to ${FIND_EXTREME_MAX_DAYS} days. ` +
        "Auto-splits the range into ≤93-day chunks (the NBP single-query limit) and aggregates results.",
      inputSchema: {
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
        skipCache: skipCacheSchema,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ start_date, end_date, extreme, skipCache }) => {
      const opts = { skipCache: skipCache ?? false };

      return runExtremeFinder({
        startDate: start_date,
        endDate: end_date,
        mode: extreme ?? "both",
        fetchChunk: async (chunkStart, chunkEnd) => {
          const points = await client.getGoldPriceHistory(
            chunkStart,
            chunkEnd,
            opts,
          );
          return points.map((p) => ({ date: p.date, value: p.price }));
        },
        errorContext: { resource: "gold" },
        emptyMessage: `No NBP gold data in the range ${start_date} → ${end_date}. NBP publishes on business days only.`,
      });
    },
  );
}
