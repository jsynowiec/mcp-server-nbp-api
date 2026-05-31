// ABOUTME: Registers the 4 NBP MCP prompts that guide agents through common
// ABOUTME: multi-step workflows (forex lookup, trend analysis, gold research, transaction planning).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "forex_assistant",
    {
      description:
        "Look up the current PLN exchange rate for a currency, optionally convert an amount, and contextualise it against the past 30 days.",
      argsSchema: {
        currency: z
          .string()
          .describe("Three-letter ISO 4217 currency code (e.g. 'USD', 'EUR')."),
        amount: z
          .string()
          .optional()
          .describe(
            "Optional amount of the foreign currency to convert to PLN.",
          ),
      },
    },
    ({ currency, amount }) => {
      const upper = currency.toUpperCase();
      const dateNote =
        "start_date and end_date are ISO 8601 calendar dates (YYYY-MM-DD), interpreted in Europe/Warsaw";
      const steps =
        amount !== undefined
          ? [
              `Call get_exchange_rate with currency='${upper}' to get the current mid rate.`,
              `Convert ${amount} ${upper} to PLN using the returned mid rate.`,
              `Call get_rate_history with currency='${upper}', start_date set to 30 days ago, end_date set to today (${dateNote}).`,
              `Compare the current rate to the 30-day average from the history stats.`,
            ]
          : [
              `Call get_exchange_rate with currency='${upper}' to get the current mid rate.`,
              `Call get_rate_history with currency='${upper}', start_date set to 30 days ago, end_date set to today (${dateNote}).`,
              `Compare the current rate to the 30-day average from the history stats.`,
            ];
      const conclusion =
        amount !== undefined
          ? `Conclude with a plain-language summary: the current rate, whether it sits above or below the recent average, and the PLN value of the conversion.`
          : `Conclude with a plain-language summary: the current rate and whether it sits above or below the recent average.`;
      const text =
        `Help the user understand the current PLN exchange rate for ${upper}.\n\n` +
        steps.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        `\n\n${conclusion}`;
      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  server.registerPrompt(
    "rate_trend_analysis",
    {
      description:
        "Analyse the trend of a currency vs. PLN over a 30-day, 90-day, or 1-year window.",
      argsSchema: {
        currency: z.string().describe("Three-letter ISO 4217 currency code."),
        period: z
          .enum(["30d", "90d", "1y"])
          .optional()
          .describe(
            "Analysis window: '30d' (default), '90d', or '1y'. The 1y window must use find_rate_extreme because get_rate_history is capped at 93 days.",
          ),
      },
    },
    ({ currency, period }) => {
      const upper = currency.toUpperCase();
      const effective = period ?? "30d";
      const days = effective === "30d" ? 30 : effective === "90d" ? 90 : 365;
      const isLongRange = effective === "1y";
      const tool = isLongRange ? "find_rate_extreme" : "get_rate_history";
      const note = isLongRange
        ? "Use find_rate_extreme because the 1-year window exceeds the 93-day limit of get_rate_history. It returns min/max with their dates and a data-point count — no daily series, no average, no first-to-last percent change."
        : `Use get_rate_history because the ${effective} window fits inside the 93-day limit. It returns the full daily series plus stats (min, max, average, first-to-last percent change).`;
      const analysisStep = isLongRange
        ? `Identify the trend direction from the min/max dates: if the maxDate is later than the minDate, ${upper} appreciated against PLN over the window; if earlier, it depreciated. Note the size of the swing (max − min).`
        : `Walk the returned series to find the largest single-day move (and when it occurred) and to characterise the overall trend direction beyond what first-to-last percent change captures.`;
      const conclusion = isLongRange
        ? `Conclude with a plain-language summary: min and max rates with their dates, the size of the swing in PLN, and whether ${upper} appears to have strengthened or weakened against PLN over the year (based on min/max ordering). Do not claim a precise percent change — the tool does not return enough data for that.`
        : `Conclude with a plain-language summary: starting and ending mid rates, first-to-last percent change, min/max with dates, the largest single-day move you identified, and whether ${upper} has strengthened or weakened against PLN over the window.`;
      const text =
        `Analyse the ${effective} (${days}-day) trend of ${upper} against PLN.\n\n` +
        `1. ${note}\n` +
        `2. Call ${tool} with currency='${upper}', start_date set to ${days} days ago, end_date set to today. Dates are ISO 8601 calendar dates (YYYY-MM-DD), interpreted in Europe/Warsaw.\n` +
        `3. ${analysisStep}\n\n` +
        conclusion;
      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  server.registerPrompt(
    "gold_price_research",
    {
      description:
        "Research the recent trajectory of NBP gold prices in PLN per gram over the past 30 or 90 days.",
      argsSchema: {
        period: z
          .enum(["30d", "90d"])
          .optional()
          .describe("Research window: '30d' (default) or '90d'."),
      },
    },
    ({ period }) => {
      const effective = period ?? "30d";
      const days = effective === "30d" ? 30 : 90;
      const text =
        `Research the ${effective} (${days}-day) trajectory of NBP gold prices in PLN per gram.\n\n` +
        `1. Call get_gold_price to get the most recent published price.\n` +
        `2. Call get_gold_price_history with start_date set to ${days} days ago, end_date set to today. Dates are ISO 8601 calendar dates (YYYY-MM-DD), interpreted in Europe/Warsaw.\n` +
        `3. Compare the latest price to the ${effective} average from the history stats, note the min/max range and their dates.\n\n` +
        `Conclude with a plain-language summary: latest price, ${effective} range, average, and whether the latest price is above or below the period average.`;
      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );

  server.registerPrompt(
    "transaction_planning",
    {
      description:
        "Estimate the cost of a currency transaction at NBP bid/ask vs. the theoretical mid rate, including the spread in PLN and as a percentage.",
      argsSchema: {
        currency: z
          .string()
          .describe(
            "Three-letter ISO 4217 currency code that must be present in Table C (major currencies only).",
          ),
        amount: z
          .string()
          .describe("Amount of the foreign currency for the transaction."),
      },
    },
    ({ currency, amount }) => {
      const upper = currency.toUpperCase();
      const text =
        `Plan a transaction of ${amount} ${upper} and explain the realistic cost vs. the theoretical mid rate.\n\n` +
        `1. Call get_bid_ask_rates with currency='${upper}' to get NBP's Table C bid and ask quotes.\n` +
        `2. Call convert_currency with amount=${amount}, from='${upper}', to='PLN' to get the mid-rate PLN value.\n` +
        `3. Compute: PLN received when selling at bid vs. PLN paid when buying at ask, and compare both to the mid-rate value. Express the spread in PLN and as a percentage of the mid value.\n\n` +
        `Conclude with a plain-language summary the user can act on: expected PLN when selling, expected PLN when buying, and the cost of the spread vs. mid.`;
      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
