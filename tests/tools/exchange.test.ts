// ABOUTME: Tests for the exchange tools (get_exchange_table, get_bid_ask_rates,
// ABOUTME: convert_currency, find_rate_extreme) via the InMemoryTransport pair.

import { NbpApiClient } from "#/nbp-api.js";
import { registerExchangeTools } from "#/tools/exchange.js";
import { installFetch, jsonResponse } from "#tests/helpers/fetch.js";
import {
  createTestPair,
  getTextContent,
  type TestPair,
} from "#tests/helpers/mcp.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const ORIGINAL_FETCH = globalThis.fetch;

const TABLE_A_PAYLOAD = [
  {
    table: "A",
    no: "123/A/NBP/2024",
    effectiveDate: "2024-06-27",
    rates: [
      { currency: "dolar amerykański", code: "USD", mid: 4.0312 },
      { currency: "euro", code: "EUR", mid: 4.3085 },
    ],
  },
];

const TABLE_C_PAYLOAD = [
  {
    table: "C",
    no: "124/C/NBP/2024",
    effectiveDate: "2024-06-27",
    rates: [
      {
        currency: "dolar amerykański",
        code: "USD",
        bid: 4.2705,
        ask: 4.3567,
      },
    ],
  },
];

const RATE_USD_PAYLOAD = {
  table: "A",
  currency: "dolar amerykański",
  code: "USD",
  rates: [{ no: "124/A/NBP/2024", effectiveDate: "2024-06-27", mid: 4.0312 }],
};

const RATE_EUR_PAYLOAD = {
  table: "A",
  currency: "euro",
  code: "EUR",
  rates: [{ no: "124/A/NBP/2024", effectiveDate: "2024-06-27", mid: 4.3085 }],
};

const RATE_GBP_PAYLOAD = {
  table: "A",
  currency: "funt szterling",
  code: "GBP",
  rates: [{ no: "124/A/NBP/2024", effectiveDate: "2024-06-27", mid: 5.0934 }],
};

const RATE_JPY_PAYLOAD = {
  table: "A",
  currency: "jen (Japonia)",
  code: "JPY",
  rates: [{ no: "124/A/NBP/2024", effectiveDate: "2024-06-27", mid: 0.025108 }],
};

const RATE_C_USD_PAYLOAD = {
  table: "C",
  currency: "dolar amerykański",
  code: "USD",
  rates: [
    {
      no: "124/C/NBP/2024",
      effectiveDate: "2024-06-27",
      bid: 4.2705,
      ask: 4.3567,
    },
  ],
};

const RATE_C_HKD_PAYLOAD = {
  table: "C",
  currency: "dolar hongkoński",
  code: "HKD",
  rates: [
    {
      no: "124/C/NBP/2024",
      effectiveDate: "2024-06-27",
      bid: 0.5121,
      ask: 0.5231,
    },
  ],
};

async function setupPair(): Promise<TestPair> {
  const apiClient = new NbpApiClient();
  return createTestPair((server) => {
    registerExchangeTools(server, apiClient);
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

describe("get_exchange_table", () => {
  test("returns Table A with mid column", async () => {
    installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_table",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("table: A");
    expect(text).toContain("effectiveDate: 2024-06-27");
    expect(text).toContain("USD");
    expect(text).toContain("EUR");
    expect(text).toMatch(/\{code,currency,mid\}/);
  });

  test("returns Table C with bid/ask columns", async () => {
    installFetch(() => jsonResponse(TABLE_C_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_exchange_table",
      arguments: { table: "C" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("table: C");
    expect(text).toMatch(/\{code,currency,bid,ask\}/);
  });
});

describe("get_bid_ask_rates", () => {
  test("returns bid, ask and spread for a Table C currency", async () => {
    installFetch(() => jsonResponse(RATE_C_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_bid_ask_rates",
      arguments: { currency: "USD" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toMatch(/bid:\s*4\.2705/);
    expect(text).toMatch(/ask:\s*4\.3567/);
    expect(text).toMatch(/spread:\s*0\.0862/); // 4.3567 - 4.2705 = 0.0862
  });

  test("includes totalBuyPln and totalSellPln when amount is provided", async () => {
    installFetch(() => jsonResponse(RATE_C_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_bid_ask_rates",
      arguments: { currency: "USD", amount: 100 },
    });

    const text = getTextContent(result);
    expect(text).toContain("amount: 100");
    expect(text).toMatch(/totalBuyPln:\s*427\.05/); // 4.2705 * 100 = 427.05
    expect(text).toMatch(/totalSellPln:\s*435\.67/); // 4.3567 * 100 = 435.67
  });

  test("accepts a valid Table C currency absent from the old static map (e.g. HKD)", async () => {
    installFetch(() => jsonResponse(RATE_C_HKD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_bid_ask_rates",
      arguments: { currency: "HKD" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toMatch(/bid:\s*0\.5121/);
    expect(text).toMatch(/ask:\s*0\.5231/);
  });

  test("currency not in Table C returns isError via API 404 mentioning the code", async () => {
    const { calls } = installFetch(() => new Response("404", { status: 404 }));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_bid_ask_rates",
      arguments: { currency: "KRW" },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).toMatch(/KRW/);
    expect(calls).toHaveLength(1);
  });

  test("404 with a date returns the business-day hint", async () => {
    installFetch(() => new Response("404", { status: 404 }));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_bid_ask_rates",
      arguments: { currency: "USD", date: "2024-06-30" },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).toMatch(/business days/i);
    expect(text).not.toMatch(/get_exchange_rate/);
    expect(text).not.toMatch(/not available in Table C/);
  });

  test("queries Table C even though no table parameter exists", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_C_USD_PAYLOAD));
    activePair = await setupPair();

    await activePair.client.callTool({
      name: "get_bid_ask_rates",
      arguments: { currency: "USD" },
    });

    expect(calls[0]!.url).toContain("/rates/C/USD/");
  });
});

describe("convert_currency", () => {
  test("returns the input amount with rate 1.0 when from == to (not an error)", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "convert_currency",
      arguments: { amount: 100, from_currency: "USD", to_currency: "USD" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("amount: 100");
    expect(text).toMatch(/rate:\s*1/);
    expect(text).toMatch(/result:\s*100/);
    expect(calls).toHaveLength(0);
  });

  test("converts foreign currency to PLN using the mid rate", async () => {
    installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "convert_currency",
      arguments: { amount: 100, from_currency: "USD", to_currency: "PLN" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toMatch(/rate:\s*4\.0312/); // 4.0312
    expect(text).toMatch(/result:\s*403\.12/); // 4.0312 * 100 = 403.12
  });

  test("converts PLN to a foreign currency by dividing by mid rate", async () => {
    installFetch(() => jsonResponse(RATE_USD_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "convert_currency",
      arguments: { amount: 400, from_currency: "PLN", to_currency: "USD" },
    });

    const text = getTextContent(result);
    expect(text).toMatch(/result:\s*99\.226/); // 400 / 4.0312 = round(99.2260369121, 4) = 99.2260
  });

  test("cross-currency conversion fetches both legs and computes the cross rate", async () => {
    const { calls } = installFetch((url) => {
      if (url.includes("/rates/A/USD/")) return jsonResponse(RATE_USD_PAYLOAD);
      if (url.includes("/rates/A/EUR/")) return jsonResponse(RATE_EUR_PAYLOAD);
      return new Response("404", { status: 404 });
    });
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "convert_currency",
      arguments: { amount: 100, from_currency: "USD", to_currency: "EUR" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("from: USD");
    expect(text).toContain("to: EUR");
    expect(text).toMatch(/sourceMid:\s*4\.0312/);
    expect(text).toMatch(/targetMid:\s*4\.3085/);
    expect(calls).toHaveLength(2);
  });

  test("cross-currency result is computed from the rounded rate, not the raw quotient", async () => {
    installFetch((url) => {
      if (url.includes("/GBP/")) return jsonResponse(RATE_GBP_PAYLOAD);
      return jsonResponse(RATE_JPY_PAYLOAD);
    });
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "convert_currency",
      arguments: { amount: 700, from_currency: "GBP", to_currency: "JPY" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toMatch(/rate:\s*202\.859646/); // 5.0934 / 0.025108 = round(202.8596463279, 6) = 202.859646
    expect(text).toMatch(/result:\s*142001\.7522/); // 700 * 202.859646 142,001.7522
  });

  test("propagates table=B to both legs of a cross-currency conversion", async () => {
    const { calls } = installFetch((url) => {
      if (url.includes("/rates/B/")) return jsonResponse(RATE_USD_PAYLOAD);
      return new Response("404", { status: 404 });
    });
    activePair = await setupPair();

    await activePair.client.callTool({
      name: "convert_currency",
      arguments: {
        amount: 100,
        from_currency: "USD",
        to_currency: "EUR",
        table: "B",
      },
    });

    expect(calls.every((c) => c.url.includes("/rates/B/"))).toBe(true);
  });
});

describe("find_rate_extreme", () => {
  test("returns isError when the range exceeds 366 days", async () => {
    installFetch(() =>
      jsonResponse({ table: "A", currency: "u", code: "USD", rates: [] }),
    );
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_rate_extreme",
      arguments: {
        currency: "USD",
        start_date: "2023-01-01",
        end_date: "2024-12-31",
      },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/366/);
  });

  test("auto-splits a full-year range into ≤93-day chunks and combines results", async () => {
    const responses = [
      {
        table: "A",
        currency: "dolar amerykański",
        code: "USD",
        rates: [
          { no: "1", effectiveDate: "2024-01-15", mid: 3.95 },
          { no: "2", effectiveDate: "2024-03-15", mid: 4.1 },
        ],
      },
      {
        table: "A",
        currency: "dolar amerykański",
        code: "USD",
        rates: [
          { no: "3", effectiveDate: "2024-05-15", mid: 4.2 },
          { no: "4", effectiveDate: "2024-06-15", mid: 3.85 },
        ],
      },
      {
        table: "A",
        currency: "dolar amerykański",
        code: "USD",
        rates: [
          { no: "5", effectiveDate: "2024-07-15", mid: 4.0 },
          { no: "6", effectiveDate: "2024-09-15", mid: 4.3 },
        ],
      },
      {
        table: "A",
        currency: "dolar amerykański",
        code: "USD",
        rates: [
          { no: "7", effectiveDate: "2024-10-15", mid: 4.05 },
          { no: "8", effectiveDate: "2024-12-15", mid: 4.25 },
        ],
      },
    ];
    let i = 0;
    const { calls } = installFetch(() => {
      const body = responses[i++]!;
      return jsonResponse(body);
    });
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_rate_extreme",
      arguments: {
        currency: "USD",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(4);
    const text = getTextContent(result);
    expect(text).toContain("min: 3.85");
    expect(text).toContain("minDate: 2024-06-15");
    expect(text).toContain("max: 4.3");
    expect(text).toContain("maxDate: 2024-09-15");
    expect(text).toContain("dataPoints: 8");
  });

  test("returns only min when extreme is 'min'", async () => {
    installFetch(() =>
      jsonResponse({
        table: "A",
        currency: "u",
        code: "USD",
        rates: [
          { no: "1", effectiveDate: "2024-06-25", mid: 3.95 },
          { no: "2", effectiveDate: "2024-06-26", mid: 4.0 },
        ],
      }),
    );
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_rate_extreme",
      arguments: {
        currency: "USD",
        start_date: "2024-06-25",
        end_date: "2024-06-26",
        extreme: "min",
      },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("min: 3.95");
    expect(text).toContain("minDate: 2024-06-25");
    expect(text).not.toMatch(/^max:/m);
    expect(text).not.toMatch(/^maxDate:/m);
  });

  test("fails entirely when any chunk fetch fails (no partial results)", async () => {
    let i = 0;
    installFetch(() => {
      i++;
      if (i === 1) {
        return jsonResponse({
          table: "A",
          currency: "u",
          code: "USD",
          rates: [{ no: "1", effectiveDate: "2024-02-15", mid: 3.9 }],
        });
      }
      return new Response("500", { status: 500 });
    });
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_rate_extreme",
      arguments: {
        currency: "USD",
        start_date: "2024-01-01",
        end_date: "2024-06-30",
      },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).not.toContain("min:");
    expect(text).not.toContain("dataPoints:");
  });

  test("propagates table=B to all chunk fetches", async () => {
    const { calls } = installFetch(() =>
      jsonResponse({
        table: "B",
        currency: "u",
        code: "AED",
        rates: [{ no: "1", effectiveDate: "2024-02-15", mid: 1.0 }],
      }),
    );
    activePair = await setupPair();

    await activePair.client.callTool({
      name: "find_rate_extreme",
      arguments: {
        currency: "AED",
        start_date: "2024-01-01",
        end_date: "2024-06-30",
        table: "B",
      },
    });

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every((c) => c.url.includes("/rates/B/AED/"))).toBe(true);
  });
});
