// ABOUTME: Tests for the NBP HTTP client — URL construction, response normalization,
// ABOUTME: caching, skipCache bypass, and NbpApiError mapping for non-2xx and network failures.

import { NbpApiClient } from "#/nbp-api.js";
import { NbpApiError } from "#/types.js";
import { installFetch, jsonResponse } from "#tests/helpers/fetch.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const ORIGINAL_FETCH = globalThis.fetch;

const TABLE_A_PAYLOAD = [
  {
    table: "A",
    no: "123/A/NBP/2024",
    effectiveDate: "2024-06-27",
    rates: [
      { currency: "dolar amerykański", code: "USD", mid: 3.9876 },
      { currency: "euro", code: "EUR", mid: 4.3201 },
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

const RATE_A_PAYLOAD = {
  table: "A",
  currency: "dolar amerykański",
  code: "USD",
  rates: [{ no: "123/A/NBP/2024", effectiveDate: "2024-06-27", mid: 3.9876 }],
};

const RATE_A_HISTORY_PAYLOAD = {
  table: "A",
  currency: "dolar amerykański",
  code: "USD",
  rates: [
    { no: "1/A/NBP/2024", effectiveDate: "2024-06-25", mid: 3.95 },
    { no: "2/A/NBP/2024", effectiveDate: "2024-06-26", mid: 3.97 },
    { no: "3/A/NBP/2024", effectiveDate: "2024-06-27", mid: 3.9876 },
  ],
};

const GOLD_LATEST_PAYLOAD = [{ data: "2024-06-27", cena: 284.45 }];

const GOLD_HISTORY_PAYLOAD = [
  { data: "2024-06-25", cena: 283.0 },
  { data: "2024-06-26", cena: 283.9 },
  { data: "2024-06-27", cena: 284.45 },
];

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("getExchangeTable", () => {
  test("constructs the latest-table URL and sends Accept: application/json", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    const result = await client.getExchangeTable("A");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/tables/A/",
    );
    const init = calls[0]!.init as RequestInit | undefined;
    const headers = new Headers(init?.headers);
    expect(headers.get("accept")).toBe("application/json");

    expect(result.table).toBe("A");
    expect(result.effectiveDate).toBe("2024-06-27");
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0]).toMatchObject({ code: "USD", mid: 3.9876 });
  });

  test("constructs the specific-date URL when date is provided", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    await client.getExchangeTable("A", "2024-06-27");

    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/tables/A/2024-06-27/",
    );
  });

  test("returns Table C entries with bid and ask fields", async () => {
    installFetch(() => jsonResponse(TABLE_C_PAYLOAD));
    const client = new NbpApiClient();

    const result = await client.getExchangeTable("C");

    expect(result.table).toBe("C");
    expect(result.rates[0]).toMatchObject({
      code: "USD",
      bid: 3.95,
      ask: 4.02,
    });
  });
});

describe("getCurrencies", () => {
  test("delegates to getExchangeTable and returns only code + name", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    const currencies = await client.getCurrencies("A");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/tables/A/",
    );
    expect(currencies).toEqual([
      { code: "USD", name: "dolar amerykański" },
      { code: "EUR", name: "euro" },
    ]);
  });

  test("shares the cache entry with getExchangeTable for the same table", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    await client.getExchangeTable("A");
    await client.getCurrencies("A");

    expect(calls).toHaveLength(1);
  });
});

describe("getExchangeRate", () => {
  test("constructs the latest-rate URL", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_PAYLOAD));
    const client = new NbpApiClient();

    const result = await client.getExchangeRate("A", "USD");

    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/rates/A/USD/",
    );
    expect(result.code).toBe("USD");
    expect(result.rates[0]).toMatchObject({
      effectiveDate: "2024-06-27",
      mid: 3.9876,
    });
  });

  test("constructs the specific-date rate URL", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_PAYLOAD));
    const client = new NbpApiClient();

    await client.getExchangeRate("A", "USD", "2024-06-27");

    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/rates/A/USD/2024-06-27/",
    );
  });

  test("uppercases lowercase currency codes in the URL", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_PAYLOAD));
    const client = new NbpApiClient();

    await client.getExchangeRate("A", "usd");

    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/rates/A/USD/",
    );
  });
});

describe("getExchangeRateHistory", () => {
  test("constructs the date-range rate URL", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_HISTORY_PAYLOAD));
    const client = new NbpApiClient();

    const result = await client.getExchangeRateHistory(
      "A",
      "USD",
      "2024-06-25",
      "2024-06-27",
    );

    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/exchangerates/rates/A/USD/2024-06-25/2024-06-27/",
    );
    expect(result.rates).toHaveLength(3);
  });
});

describe("getGoldPrice", () => {
  test("constructs the latest-gold URL and normalizes data/cena to date/price", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    const client = new NbpApiClient();

    const result = await client.getGoldPrice();

    expect(calls[0]!.url).toBe("https://api.nbp.pl/api/cenyzlota/");
    expect(result).toEqual({ date: "2024-06-27", price: 284.45 });
  });

  test("constructs the specific-date gold URL", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    const client = new NbpApiClient();

    await client.getGoldPrice("2024-06-27");

    expect(calls[0]!.url).toBe("https://api.nbp.pl/api/cenyzlota/2024-06-27/");
  });
});

describe("getGoldPriceHistory", () => {
  test("constructs the date-range gold URL and normalizes each entry", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_HISTORY_PAYLOAD));
    const client = new NbpApiClient();

    const result = await client.getGoldPriceHistory("2024-06-25", "2024-06-27");

    expect(calls[0]!.url).toBe(
      "https://api.nbp.pl/api/cenyzlota/2024-06-25/2024-06-27/",
    );
    expect(result).toEqual([
      { date: "2024-06-25", price: 283.0 },
      { date: "2024-06-26", price: 283.9 },
      { date: "2024-06-27", price: 284.45 },
    ]);
  });
});

describe("caching", () => {
  test("a cache hit returns the stored value without a second fetch", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    const first = await client.getExchangeTable("A");
    const second = await client.getExchangeTable("A");

    expect(calls).toHaveLength(1);
    expect(second).toEqual(first);
  });

  test("different paths use distinct cache entries", async () => {
    const { calls } = installFetch((url) => {
      if (url.endsWith("/A/")) return jsonResponse(TABLE_A_PAYLOAD);
      return jsonResponse(TABLE_C_PAYLOAD);
    });
    const client = new NbpApiClient();

    await client.getExchangeTable("A");
    await client.getExchangeTable("C");

    expect(calls).toHaveLength(2);
  });

  test("skipCache bypasses the cache read", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    await client.getExchangeTable("A");
    await client.getExchangeTable("A", undefined, { skipCache: true });

    expect(calls).toHaveLength(2);
  });

  test("skipCache also bypasses the cache write", async () => {
    const { calls } = installFetch(() => jsonResponse(TABLE_A_PAYLOAD));
    const client = new NbpApiClient();

    await client.getExchangeTable("A", undefined, { skipCache: true });
    await client.getExchangeTable("A");

    expect(calls).toHaveLength(2);
  });
});

describe("path-segment validation", () => {
  test("getExchangeRate rejects a code with non-letter characters before fetching", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_PAYLOAD));
    const client = new NbpApiClient();

    await expect(client.getExchangeRate("A", "../../etc")).rejects.toThrow(
      /invalid.*code/i,
    );
    expect(calls).toHaveLength(0);
  });

  test("getExchangeRate rejects a date that is not YYYY-MM-DD before fetching", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_PAYLOAD));
    const client = new NbpApiClient();

    await expect(
      client.getExchangeRate("A", "USD", "../../2024-06-27"),
    ).rejects.toThrow(/invalid.*date/i);
    expect(calls).toHaveLength(0);
  });

  test("getExchangeRateHistory rejects a code with path-traversal characters", async () => {
    const { calls } = installFetch(() => jsonResponse(RATE_A_HISTORY_PAYLOAD));
    const client = new NbpApiClient();

    await expect(
      client.getExchangeRateHistory("A", "US/D", "2024-01-01", "2024-06-30"),
    ).rejects.toThrow(/invalid.*code/i);
    expect(calls).toHaveLength(0);
  });

  test("getGoldPrice rejects a date containing path-traversal characters", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    const client = new NbpApiClient();

    await expect(client.getGoldPrice("../2024-06-27")).rejects.toThrow(
      /invalid.*date/i,
    );
    expect(calls).toHaveLength(0);
  });

  test("getGoldPriceHistory rejects an end date that is not YYYY-MM-DD", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_HISTORY_PAYLOAD));
    const client = new NbpApiClient();

    await expect(
      client.getGoldPriceHistory("2024-01-01", "not-a-date"),
    ).rejects.toThrow(/invalid.*date/i);
    expect(calls).toHaveLength(0);
  });
});

describe("error mapping", () => {
  test("a 404 response throws NbpApiError with statusCode 404", async () => {
    installFetch(() => new Response("404 NotFound", { status: 404 }));
    const client = new NbpApiClient();

    let caught: unknown;
    try {
      await client.getExchangeRate("A", "USD", "2024-06-29");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NbpApiError);
    expect((caught as NbpApiError).statusCode).toBe(404);
  });

  test("a 400 response throws NbpApiError with statusCode 400", async () => {
    installFetch(
      () => new Response("400 BadRequest - DateTime", { status: 400 }),
    );
    const client = new NbpApiClient();

    let caught: unknown;
    try {
      await client.getExchangeRateHistory(
        "A",
        "USD",
        "2024-01-01",
        "2024-12-31",
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NbpApiError);
    expect((caught as NbpApiError).statusCode).toBe(400);
  });

  test("a fetch rejection (network error) throws NbpApiError with statusCode 0", async () => {
    installFetch(() => {
      throw new TypeError("network failure");
    });
    const client = new NbpApiClient();

    let caught: unknown;
    try {
      await client.getExchangeTable("A");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NbpApiError);
    expect((caught as NbpApiError).statusCode).toBe(0);
    expect((caught as NbpApiError).message).toMatch(/network/i);
  });

  test("non-JSON response body throws NbpApiError (not SyntaxError)", async () => {
    installFetch(
      () =>
        new Response("<html>NBP maintenance</html>", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new NbpApiClient();

    let caught: unknown;
    try {
      await client.getExchangeTable("A");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NbpApiError);
    expect((caught as NbpApiError).message).toMatch(/invalid JSON/i);
  });

  test("failed responses are not cached", async () => {
    let callCount = 0;
    const { calls } = installFetch(() => {
      callCount++;
      if (callCount === 1) {
        return new Response("404", { status: 404 });
      }
      return jsonResponse(TABLE_A_PAYLOAD);
    });
    const client = new NbpApiClient();

    await expect(client.getExchangeTable("A")).rejects.toBeInstanceOf(
      NbpApiError,
    );
    const result = await client.getExchangeTable("A");

    expect(calls).toHaveLength(2);
    expect(result.table).toBe("A");
  });
});
