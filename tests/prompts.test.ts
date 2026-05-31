// ABOUTME: Tests for src/prompts.ts via InMemoryTransport — verifies prompt registration,
// ABOUTME: argument schemas, and rendered message content for each of the 4 prompts.

import { registerPrompts } from "#/prompts.js";
import { createTestPair, type TestPair } from "#tests/helpers/mcp.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let pair: TestPair;

beforeEach(async () => {
  pair = await createTestPair((server) => {
    registerPrompts(server);
  });
});

afterEach(async () => {
  await pair.close();
});

function getText(messages: Awaited<ReturnType<typeof pair.client.getPrompt>>) {
  const first = messages.messages[0];
  if (!first || first.content.type !== "text") {
    throw new Error("expected first message to be text");
  }
  return first.content.text;
}

describe("registerPrompts — registration", () => {
  test("registers all 4 prompts with expected names", async () => {
    const result = await pair.client.listPrompts();
    const names = result.prompts.map((p) => p.name).sort();
    expect(names).toEqual([
      "forex_assistant",
      "gold_price_research",
      "rate_trend_analysis",
      "transaction_planning",
    ]);
  });
});

describe("forex_assistant", () => {
  test("declares currency required, amount optional", async () => {
    const result = await pair.client.listPrompts();
    const prompt = result.prompts.find((p) => p.name === "forex_assistant");
    const args = prompt?.arguments ?? [];
    const currency = args.find((a) => a.name === "currency");
    const amount = args.find((a) => a.name === "amount");
    expect(currency?.required).toBe(true);
    expect(amount?.required).toBe(false);
  });

  test("renders message mentioning the currency and history tool", async () => {
    const result = await pair.client.getPrompt({
      name: "forex_assistant",
      arguments: { currency: "USD" },
    });
    const text = getText(result);
    expect(text).toContain("USD");
    expect(text).toContain("get_exchange_rate");
    expect(text).toContain("get_rate_history");
  });

  test("includes the amount in the conversion instruction when provided", async () => {
    const result = await pair.client.getPrompt({
      name: "forex_assistant",
      arguments: { currency: "EUR", amount: "250" },
    });
    const text = getText(result);
    expect(text).toContain("EUR");
    expect(text).toContain("250");
  });
});

describe("rate_trend_analysis", () => {
  test("declares currency required, period optional", async () => {
    const result = await pair.client.listPrompts();
    const prompt = result.prompts.find((p) => p.name === "rate_trend_analysis");
    const args = prompt?.arguments ?? [];
    expect(args.find((a) => a.name === "currency")?.required).toBe(true);
    expect(args.find((a) => a.name === "period")?.required).toBe(false);
  });

  test("default period uses get_rate_history (30d)", async () => {
    const result = await pair.client.getPrompt({
      name: "rate_trend_analysis",
      arguments: { currency: "GBP" },
    });
    const text = getText(result);
    expect(text).toContain("GBP");
    expect(text).toContain("get_rate_history");
    expect(text).toContain("30");
  });

  test("1y period switches to find_rate_extreme", async () => {
    const result = await pair.client.getPrompt({
      name: "rate_trend_analysis",
      arguments: { currency: "CHF", period: "1y" },
    });
    const text = getText(result);
    expect(text).toContain("find_rate_extreme");
  });
});

describe("gold_price_research", () => {
  test("period optional, defaults documented", async () => {
    const result = await pair.client.listPrompts();
    const prompt = result.prompts.find((p) => p.name === "gold_price_research");
    const args = prompt?.arguments ?? [];
    const period = args.find((a) => a.name === "period");
    expect(period?.required).toBe(false);
  });

  test("renders message referencing both gold tools", async () => {
    const result = await pair.client.getPrompt({
      name: "gold_price_research",
      arguments: {},
    });
    const text = getText(result);
    expect(text).toContain("get_gold_price");
    expect(text).toContain("get_gold_price_history");
    expect(text).toContain("30");
  });

  test("90d period propagates into the message", async () => {
    const result = await pair.client.getPrompt({
      name: "gold_price_research",
      arguments: { period: "90d" },
    });
    const text = getText(result);
    expect(text).toContain("90");
  });
});

describe("transaction_planning", () => {
  test("declares currency and amount both required", async () => {
    const result = await pair.client.listPrompts();
    const prompt = result.prompts.find(
      (p) => p.name === "transaction_planning",
    );
    const args = prompt?.arguments ?? [];
    expect(args.find((a) => a.name === "currency")?.required).toBe(true);
    expect(args.find((a) => a.name === "amount")?.required).toBe(true);
  });

  test("renders message referencing the bid/ask and convert tools and the amount", async () => {
    const result = await pair.client.getPrompt({
      name: "transaction_planning",
      arguments: { currency: "USD", amount: "1000" },
    });
    const text = getText(result);
    expect(text).toContain("USD");
    expect(text).toContain("1000");
    expect(text).toContain("get_bid_ask_rates");
    expect(text).toContain("convert_currency");
  });
});
