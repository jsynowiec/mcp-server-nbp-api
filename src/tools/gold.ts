// ABOUTME: Registers the gold tools: get_gold_price, get_gold_price_history,
// ABOUTME: find_gold_price_extreme. The extreme tool auto-splits the 93-day NBP limit.

import type { NbpApiClient } from "#/nbp-api.js";
import { formatNbpApiError } from "#/tools/errors.js";
import {
  formatExtremeResponse,
  formatGoldPrice,
  formatHistoryResponse,
  type ExtremeStats,
  type GoldSeriesPoint,
  type HistoryStats,
} from "#/tools/format.js";
import { chunkDateRange, daysInclusive, validateDate } from "#/tools/utils.js";
import { NbpApiError } from "#/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

const extremeEnum = z.enum(["min", "max", "both"]);
const skipCacheSchema = z
  .boolean()
  .optional()
  .describe(
    "Bypass the in-process cache and fetch a fresh value from NBP. Default: false.",
  );

const FIND_EXTREME_MAX_DAYS = 366;
const HISTORY_CHUNK_DAYS = 93;

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
      if (date !== undefined) {
        try {
          validateDate(date, "date");
        } catch (e) {
          return err((e as Error).message);
        }
      }

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
      try {
        validateDate(start_date, "start_date");
        validateDate(end_date, "end_date");
      } catch (e) {
        return err((e as Error).message);
      }

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

        const stats = computeGoldStats(series);
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
      const mode = extreme ?? "both";

      try {
        validateDate(start_date, "start_date");
        validateDate(end_date, "end_date");
      } catch (e) {
        return err((e as Error).message);
      }

      if (start_date > end_date) {
        return err(
          `start_date '${start_date}' must be on or before end_date '${end_date}'.`,
        );
      }

      const span = daysInclusive(start_date, end_date);
      if (span > FIND_EXTREME_MAX_DAYS) {
        return err(
          `Date range of ${span} days exceeds the ${FIND_EXTREME_MAX_DAYS}-day limit for find_gold_price_extreme.`,
        );
      }

      const chunks = chunkDateRange(start_date, end_date, HISTORY_CHUNK_DAYS);
      const opts = { skipCache: skipCache ?? false };
      const series: GoldSeriesPoint[] = [];

      try {
        for (const [chunkStart, chunkEnd] of chunks) {
          const points = await client.getGoldPriceHistory(
            chunkStart,
            chunkEnd,
            opts,
          );
          for (const p of points) {
            series.push({ date: p.date, price: p.price });
          }
        }
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

      if (series.length === 0) {
        return err(
          `No NBP gold data in the range ${start_date} → ${end_date}. NBP publishes on business days only.`,
        );
      }

      return ok(formatExtremeResponse(computeExtreme(series, mode)));
    },
  );
}

function computeGoldStats(series: GoldSeriesPoint[]): HistoryStats {
  const first = series[0]!;
  const last = series[series.length - 1]!;

  let min = first.price;
  let max = first.price;
  let minDate = first.date;
  let maxDate = first.date;
  let sum = 0;

  for (const point of series) {
    if (point.price < min) {
      min = point.price;
      minDate = point.date;
    }
    if (point.price > max) {
      max = point.price;
      maxDate = point.date;
    }
    sum += point.price;
  }

  const avg = round(sum / series.length, 4);
  const pct = ((last.price - first.price) / first.price) * 100;
  const sign = pct >= 0 ? "+" : "";
  const change = `${sign}${pct.toFixed(2)}% (${first.date} → ${last.date})`;

  return { min, minDate, max, maxDate, avg, change };
}

function computeExtreme(
  series: GoldSeriesPoint[],
  mode: "min" | "max" | "both",
): ExtremeStats {
  const first = series[0]!;
  let min = first.price;
  let max = first.price;
  let minDate = first.date;
  let maxDate = first.date;

  for (const point of series) {
    if (point.price < min) {
      min = point.price;
      minDate = point.date;
    }
    if (point.price > max) {
      max = point.price;
      maxDate = point.date;
    }
  }

  const dataPoints = series.length;
  if (mode === "min") {
    return { min, minDate, dataPoints };
  }
  if (mode === "max") {
    return { max, maxDate, dataPoints };
  }
  return { min, minDate, max, maxDate, dataPoints };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
