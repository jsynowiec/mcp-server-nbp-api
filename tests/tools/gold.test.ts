// ABOUTME: Tests for the gold tools (get_gold_price, get_gold_price_history,
// ABOUTME: find_gold_price_extreme) via the InMemoryTransport pair.

import { NbpApiClient } from "#/nbp-api.js";
import { registerGoldTools } from "#/tools/gold.js";
import { installFetch, jsonResponse } from "#tests/helpers/fetch.js";
import {
  createTestPair,
  getTextContent,
  type TestPair,
} from "#tests/helpers/mcp.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const ORIGINAL_FETCH = globalThis.fetch;

const GOLD_LATEST_PAYLOAD = [{ data: "2024-06-27", cena: 284.45 }];

const GOLD_HISTORY_PAYLOAD = [
  { data: "2024-06-25", cena: 280.0 },
  { data: "2024-06-26", cena: 283.9 },
  { data: "2024-06-27", cena: 287.5 },
];

async function setupPair(): Promise<TestPair> {
  const apiClient = new NbpApiClient();
  return createTestPair((server) => {
    registerGoldTools(server, apiClient);
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

describe("get_gold_price", () => {
  test("returns price per gram and effective date", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(calls[0]!.url).toBe("https://api.nbp.pl/api/cenyzlota/");
    const text = getTextContent(result);
    expect(text).toContain("date: 2024-06-27");
    expect(text).toMatch(/pricePerGram:\s*284\.45/);
  });

  test("includes totalPln when amount_grams is provided", async () => {
    installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price",
      arguments: { amount_grams: 10 },
    });

    const text = getTextContent(result);
    expect(text).toMatch(/amountGrams:\s*10/);
    expect(text).toMatch(/totalPln:\s*2844\.5/);
  });

  test("queries the specific-date URL when date is provided", async () => {
    const { calls } = installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    activePair = await setupPair();

    await activePair.client.callTool({
      name: "get_gold_price",
      arguments: { date: "2024-06-27" },
    });

    expect(calls[0]!.url).toBe("https://api.nbp.pl/api/cenyzlota/2024-06-27/");
  });

  test("returns isError with a business-day hint on 404 with date", async () => {
    installFetch(() => new Response("404", { status: 404 }));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price",
      arguments: { date: "2024-06-30" },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/business days/i);
  });

  test("returns isError with future-date message when date is in the future", async () => {
    installFetch(() => jsonResponse(GOLD_LATEST_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price",
      arguments: { date: "2099-01-01" },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/future/i);
  });
});

describe("get_gold_price_history", () => {
  test("returns stats and price series with first-to-last percent change", async () => {
    installFetch(() => jsonResponse(GOLD_HISTORY_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price_history",
      arguments: { start_date: "2024-06-25", end_date: "2024-06-27" },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("min: 280");
    expect(text).toContain("minDate: 2024-06-25");
    expect(text).toContain("max: 287.5");
    expect(text).toContain("maxDate: 2024-06-27");
    // first 280 -> last 287.5 → +2.68%
    expect(text).toMatch(/change:\s*\+2\.68%/);
    expect(text).toContain("prices[3]{date,price}:");
  });

  test("returns isError pointing to find_gold_price_extreme when range exceeds 93 days", async () => {
    installFetch(() => jsonResponse(GOLD_HISTORY_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price_history",
      arguments: { start_date: "2024-01-01", end_date: "2024-12-31" },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).toMatch(/93[- ]day/);
    expect(text).toMatch(/find_gold_price_extreme/);
  });

  test("returns isError when start_date is after end_date", async () => {
    installFetch(() => jsonResponse(GOLD_HISTORY_PAYLOAD));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "get_gold_price_history",
      arguments: { start_date: "2024-06-30", end_date: "2024-06-01" },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/start_date/);
  });
});

describe("find_gold_price_extreme", () => {
  test("returns isError when the range exceeds 366 days", async () => {
    installFetch(() => jsonResponse([]));
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_gold_price_extreme",
      arguments: { start_date: "2023-01-01", end_date: "2024-12-31" },
    });

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toMatch(/366/);
  });

  test("auto-splits a full-year range into ≤93-day chunks and aggregates", async () => {
    const responses = [
      [
        { data: "2024-01-15", cena: 280.0 },
        { data: "2024-03-15", cena: 290.0 },
      ],
      [
        { data: "2024-05-15", cena: 275.5 },
        { data: "2024-06-15", cena: 295.0 },
      ],
      [
        { data: "2024-07-15", cena: 300.0 },
        { data: "2024-09-15", cena: 282.0 },
      ],
      [
        { data: "2024-10-15", cena: 305.5 },
        { data: "2024-12-15", cena: 298.0 },
      ],
    ];
    let i = 0;
    const { calls } = installFetch(() => {
      const body = responses[i++]!;
      return jsonResponse(body);
    });
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_gold_price_extreme",
      arguments: { start_date: "2024-01-01", end_date: "2024-12-31" },
    });

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(4);
    const text = getTextContent(result);
    expect(text).toContain("min: 275.5");
    expect(text).toContain("minDate: 2024-05-15");
    expect(text).toContain("max: 305.5");
    expect(text).toContain("maxDate: 2024-10-15");
    expect(text).toContain("dataPoints: 8");
  });

  test("returns only max when extreme is 'max'", async () => {
    installFetch(() =>
      jsonResponse([
        { data: "2024-06-25", cena: 280.0 },
        { data: "2024-06-26", cena: 285.0 },
      ]),
    );
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_gold_price_extreme",
      arguments: {
        start_date: "2024-06-25",
        end_date: "2024-06-26",
        extreme: "max",
      },
    });

    expect(result.isError).toBeFalsy();
    const text = getTextContent(result);
    expect(text).toContain("max: 285");
    expect(text).toContain("maxDate: 2024-06-26");
    expect(text).not.toMatch(/^min:/m);
    expect(text).not.toMatch(/^minDate:/m);
  });

  test("fails entirely when any chunk fetch fails (no partial results)", async () => {
    let i = 0;
    installFetch(() => {
      i++;
      if (i === 1) {
        return jsonResponse([{ data: "2024-02-15", cena: 280.0 }]);
      }
      return new Response("500", { status: 500 });
    });
    activePair = await setupPair();

    const result = await activePair.client.callTool({
      name: "find_gold_price_extreme",
      arguments: { start_date: "2024-01-01", end_date: "2024-06-30" },
    });

    expect(result.isError).toBe(true);
    const text = getTextContent(result);
    expect(text).not.toContain("min:");
    expect(text).not.toContain("dataPoints:");
  });
});
