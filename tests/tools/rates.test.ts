// ABOUTME: Tests for the rate tools (list_currencies, get_exchange_rate, get_rate_history,
// ABOUTME: compare_currencies) exercised end-to-end through the MCP InMemoryTransport pair.

import { NbpApiClient } from "#/nbp-api.js";
import { registerRateTools } from "#/tools/rates.js";
import { getWarsawToday } from "#/tools/utils.js";
import { warsawTomorrow } from "#tests/helpers/dates.js";
import { installFetch, jsonResponse } from "#tests/helpers/fetch.js";
import {
  createTestPair,
  getTextContent,
  type TestPair,
} from "#tests/helpers/mcp.js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  type Mock,
} from "bun:test";

const ORIGINAL_FETCH = globalThis.fetch;

const TABLE_A_PAYLOAD = [
  {
    table: "A",
    no: "123/A/NBP/2024",
    effectiveDate: "2024-06-27",
    rates: [
      { currency: "dolar amerykański", code: "USD", mid: 3.9876 },
      { currency: "euro", code: "EUR", mid: 4.3201 },
      { currency: "frank szwajcarski", code: "CHF", mid: 4.45 },
    ],
  },
];

const TABLE_C_PAYLOAD = [
  {
    table: "C",
    no: "123/C/NBP/2024",
    effectiveDate: "2024-06-27",
    rates: [
      {
        currency: "dolar amerykański",
        code: "USD",
        bid: 3.95,
        ask: 4.02,
      },
    ],
  },
];

const RATE_USD_PAYLOAD = {
  table: "A",
  currency: "dolar amerykański",
  code: "USD",
  rates: [{ no: "123/A/NBP/2024", effectiveDate: "2024-06-27", mid: 3.9876 }],
};

const RATE_USD_HISTORY_PAYLOAD = {
  table: "A",
  currency: "dolar amerykański",
  code: "USD",
  rates: [
    { no: "1/A/NBP/2024", effectiveDate: "2024-06-25", mid: 3.9 },
    { no: "2/A/NBP/2024", effectiveDate: "2024-06-26", mid: 3.95 },
    { no: "3/A/NBP/2024", effectiveDate: "2024-06-27", mid: 4.0 },
  ],
};

async function setupPair(): Promise<TestPair> {
  const apiClient = new NbpApiClient();
  return createTestPair((server) => {
    registerRateTools(server, apiClient);
  });
}

let activePair: TestPair | undefined;

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

afterEach(async () => {
  if (activePair) {
    await activePair.close();
    activePair = undefined;
  }
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("list_currencies", () => {
  test("returns code+name entries for Table A by default", async () => {
    installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "list_currencies",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("USD");
    expect(text).toContain("EUR");
    expect(text).toContain("dolar amerykański");
  });

  test("queries Table C when table parameter is C", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_C_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "list_currencies",
      arguments: { table: "C" },
    });

    expect(result.isError).toBeFalsy();
    expect(calls[0]!.url).toContain("/tables/C/");
  });
});

describe("get_exchange_rate", () => {
  test("returns mid rate, currency name and effective date", async () => {
    installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "USD" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("USD");
    expect(text).toContain("3.9876");
    expect(text).toContain("2024-06-27");
  });

  test("includes PLN conversion when amount is provided", async () => {
    installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "USD", amount: 100 },
    });

    const text = getTextContent(result);
    expect(text).toContain("amount: 100");
    expect(text).toMatch(/plnValue: 398\.76/);
  });

  test("queries the specific-date URL when date is provided", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "USD", date: "2024-06-27" },
    });

    expect(calls[0]!.url).toContain("/rates/A/USD/2024-06-27/");
  });

  test("returns isError with unknown-currency hint on 404 without date", async () => {
    installFetch(() => new Response("404", { status: 404 }));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "XYZ" },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).toMatch(/XYZ/);
    expect(text).toMatch(/list_currencies/);
  });

  test("rejects dates before 2002-01-02 without calling the API", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "USD", date: "2001-06-15" },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/2002-01-02/);
    expect(calls).toHaveLength(0);
  });

  test("does not pre-filter currency codes absent from the static map", async () => {
    const TWD_PAYLOAD = {
      table: "A",
      currency: "dolar tajwański",
      code: "TWD",
      rates: [{ no: "1/A/NBP/2024", effectiveDate: "2024-06-27", mid: 0.1234 }],
    };
    installFetch(() => jsonResponse(TWD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "TWD" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toMatch(/TWD/);
    expect(text).toMatch(/0\.1234/);
  });

  test("returns isError with future-date message when date is in the future (Warsaw TZ)", async () => {
    installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "USD", date: warsawTomorrow() },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/future/i);
  });

  test("returns isError with invalid-date message for malformed dates", async () => {
    installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_rate",
      arguments: { currency: "USD", date: "27-06-2024" },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/Invalid date/);
  });
});

describe("get_rate_history", () => {
  test("returns stats and rate series with first-to-last percent change", async () => {
    installFetch(() => jsonResponse(RATE_USD_HISTORY_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_rate_history",
      arguments: {
        currency: "USD",
        start_date: "2024-06-25",
        end_date: "2024-06-27",
      },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("min: 3.9");
    expect(text).toContain("max: 4");
    expect(text).toContain("minDate: 2024-06-25");
    expect(text).toContain("maxDate: 2024-06-27");
    expect(text).toContain("avg:");
    // first 3.9 -> last 4.0 => +2.56%
    expect(text).toMatch(/change:\s*\+2\.56%/);
    expect(text).toMatch(/2024-06-25\s*→\s*2024-06-27/);
    expect(text).toContain("rates[3]{date,mid}:");
  });

  test("returns isError pointing to find_rate_extreme when range exceeds 93 days", async () => {
    installFetch(() => jsonResponse(RATE_USD_HISTORY_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_rate_history",
      arguments: {
        currency: "USD",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).toMatch(/93[- ]day/);
    expect(text).toMatch(/find_rate_extreme/);
  });

  test("returns isError when start_date is after end_date", async () => {
    installFetch(() => jsonResponse(RATE_USD_HISTORY_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_rate_history",
      arguments: {
        currency: "USD",
        start_date: "2024-06-30",
        end_date: "2024-06-01",
      },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/start_date/);
  });

  test("does not call the network when validation fails", async () => {
    const { fn } = installFetch(() => jsonResponse(RATE_USD_HISTORY_PAYLOAD));
    const fetchFn = fn as unknown as Mock<typeof globalThis.fetch>;
    activePair = await setupPair();

    await activePair.client.callTool({
      name: "get_rate_history",
      arguments: {
        currency: "USD",
        start_date: "2024-06-30",
        end_date: "2024-06-01",
      },
    });

    expect(fetchFn.mock.calls).toHaveLength(0);
  });

  test("404 for range ending today includes the 11:30 CET publication-time hint", async () => {
    installFetch(() => new Response("404", { status: 404 }));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_rate_history",
      arguments: {
        currency: "USD",
        start_date: getWarsawToday(),
        end_date: getWarsawToday(),
      },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).toMatch(/11:30 CET/);
  });
});

describe("compare_currencies", () => {
  test("returns a TOON table sorted by mid rate for the requested codes", async () => {
    installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "compare_currencies",
      arguments: { currencies: ["CHF", "USD", "EUR"] },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("USD");
    expect(text).toContain("EUR");
    expect(text).toContain("CHF");
    // rows are emitted under a named field, matching the rest of the TOON helpers
    expect(text).toMatch(/rows\[3\]\{code,currency,mid\}:/);
    // sorted ascending by mid: USD (3.9876), EUR (4.3201), CHF (4.45)
    const usdIdx = text.indexOf("USD");
    const eurIdx = text.indexOf("EUR");
    const chfIdx = text.indexOf("CHF");
    expect(usdIdx).toBeLessThan(eurIdx);
    expect(eurIdx).toBeLessThan(chfIdx);
    // no missing-code note when everything resolves
    expect(text).not.toMatch(/Not found/);
  });

  test("emits a TOON missing[] field when some requested codes are not in the table", async () => {
    installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "compare_currencies",
      arguments: { currencies: ["USD", "EUR", "XYZ", "QQQ"] },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("missing[2]: XYZ,QQQ");
  });

  test("rejects fewer than one code with isError and a min-element message", async () => {
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "compare_currencies",
      arguments: { currencies: [] },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/at least 1/i);
  });

  test("rejects more than ten codes with isError and a max-element message", async () => {
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "compare_currencies",
      arguments: {
        currencies: [
          "USD",
          "EUR",
          "GBP",
          "CHF",
          "JPY",
          "CNY",
          "CAD",
          "AUD",
          "NZD",
          "SEK",
          "NOK",
        ],
      },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/at most 10/i);
  });

  test("rejects currency codes that aren't 3 letters with isError", async () => {
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "compare_currencies",
      arguments: { currencies: ["USDOLLAR"] },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/3-letter/i);
  });
});
