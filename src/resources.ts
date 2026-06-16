// ABOUTME: Registers the 5 MCP resources: 3 currency lists (Tables A/B/C) and
// ABOUTME: 2 static metadata documents (tables overview and publication schedule).

import type { NbpApiClient } from "#/nbp-api.js";
import type { TableType } from "#/types.js";
import { NbpApiError } from "#/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const TABLES_METADATA = `NBP exchange-rate tables

Currency codes throughout the NBP API follow ISO 4217 (three uppercase letters, e.g. USD, EUR, GBP).

Table A — mid rates for major currencies (~35 currencies). Updated each business day.
  Use when you need a single reference rate (mid) for a common currency such as USD, EUR, GBP.

Table B — mid rates for the extended set of currencies (~130 currencies). Updated weekly (Wednesdays).
  Use for less common currencies that are absent from Table A.

Table C — bid and ask rates for major currencies (~28 currencies). Updated each business day.
  Use when you need NBP's buy/sell quote (e.g. to estimate transaction cost vs. the mid rate).
  Table C has far fewer currencies than A or B. If a currency is missing from C, fall back to Table A's mid rate via get_exchange_rate.
`;

const SCHEDULE_METADATA = `NBP API publication schedule and data limits

Date format
  All dates accepted and returned by the NBP API are ISO 8601 calendar dates in YYYY-MM-DD form
  (e.g. 2026-05-30), interpreted in the Europe/Warsaw timezone.

Publication days
  NBP publishes rates and gold prices on Polish business days only (Mon–Fri, excluding Polish public holidays).
  A 404 response for a Saturday, Sunday, or public holiday is expected — not an error.

Publication time
  Rates are typically published around 11:30 CET (Europe/Warsaw).
  Querying today before publication returns 404. Omit the date to get the most recent available value.

Data availability
  Exchange-rate data starts on 2002-01-02.
  Gold-price data starts on 2013-01-02.
  Requesting a date earlier than these returns 404.

Range limits
  A single date-range query is limited to 93 days. The history tools (get_rate_history,
  get_gold_price_history) enforce this and point the agent to find_rate_extreme /
  find_gold_price_extreme for longer ranges.
  The extreme-finders auto-split larger ranges up to a hard cap of 366 days.
`;

export function registerResources(
  server: McpServer,
  client: NbpApiClient,
): void {
  const tables: TableType[] = ["A", "B", "C"];
  for (const table of tables) {
    const uri = `nbp://currencies/${table}`;
    server.registerResource(
      `currencies-${table.toLowerCase()}`,
      uri,
      {
        description: `Every currency present in NBP Table ${table}, as a JSON array of {code, name}.`,
        mimeType: "application/json",
      },
      async () => {
        try {
          const currencies = await client.getCurrencies(table);
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(currencies),
              },
            ],
          };
        } catch (e) {
          if (e instanceof NbpApiError) {
            throw new Error(
              `NBP API error fetching Table ${table} currencies: ${e.message}`,
              { cause: e },
            );
          }
          throw e;
        }
      },
    );
  }

  const metaTablesUri = "nbp://meta/tables";
  server.registerResource(
    "meta-tables",
    metaTablesUri,
    {
      description:
        "Overview of NBP exchange-rate tables (A, B, C): what each contains, update cadence, and when to use each.",
      mimeType: "text/plain",
    },
    () => ({
      contents: [
        {
          uri: metaTablesUri,
          mimeType: "text/plain",
          text: TABLES_METADATA,
        },
      ],
    }),
  );

  const metaScheduleUri = "nbp://meta/schedule";
  server.registerResource(
    "meta-schedule",
    metaScheduleUri,
    {
      description:
        "NBP API publication schedule, business-day caveats, data availability start dates, and 93-day range limit.",
      mimeType: "text/plain",
    },
    () => ({
      contents: [
        {
          uri: metaScheduleUri,
          mimeType: "text/plain",
          text: SCHEDULE_METADATA,
        },
      ],
    }),
  );
}
