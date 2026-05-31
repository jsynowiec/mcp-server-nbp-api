// ABOUTME: Tests for src/resources.ts via InMemoryTransport — verifies registration,
// ABOUTME: mimeTypes, client invocation for currency lists, and error propagation.

import { NbpApiClient } from "#/nbp-api.js";
import { registerResources } from "#/resources.js";
import { NbpApiError } from "#/types.js";
import { installFetch, jsonResponse } from "#tests/helpers/fetch.js";
import { createTestPair, type TestPair } from "#tests/helpers/mcp.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let pair: TestPair;
let client: NbpApiClient;

async function setup(): Promise<void> {
  client = new NbpApiClient();
  pair = await createTestPair((server) => {
    registerResources(server, client);
  });
}

afterEach(async () => {
  await pair.close();
});

describe("registerResources — registration", () => {
  beforeEach(setup);

  test("registers all 5 resources with expected URIs", async () => {
    const result = await pair.client.listResources();
    const uris = result.resources.map((r) => r.uri).sort();
    expect(uris).toEqual([
      "nbp://currencies/A",
      "nbp://currencies/B",
      "nbp://currencies/C",
      "nbp://meta/schedule",
      "nbp://meta/tables",
    ]);
  });

  test("currency-list resources advertise application/json mimeType", async () => {
    const result = await pair.client.listResources();
    const aListing = result.resources.find(
      (r) => r.uri === "nbp://currencies/A",
    );
    expect(aListing?.mimeType).toBe("application/json");
  });

  test("metadata resources advertise text/plain mimeType", async () => {
    const result = await pair.client.listResources();
    const tables = result.resources.find((r) => r.uri === "nbp://meta/tables");
    const schedule = result.resources.find(
      (r) => r.uri === "nbp://meta/schedule",
    );
    expect(tables?.mimeType).toBe("text/plain");
    expect(schedule?.mimeType).toBe("text/plain");
  });
});

describe("nbp://currencies/{table}", () => {
  beforeEach(setup);

  test("returns JSON array of {code, name} from the client", async () => {
    installFetch(() =>
      jsonResponse([
        {
          table: "A",
          no: "100/A/NBP/2026",
          effectiveDate: "2026-05-30",
          rates: [
            { currency: "US Dollar", code: "USD", mid: 4.0 },
            { currency: "Euro", code: "EUR", mid: 4.3 },
          ],
        },
      ]),
    );

    const result = await pair.client.readResource({
      uri: "nbp://currencies/A",
    });
    expect(result.contents).toHaveLength(1);
    const first = result.contents[0];
    expect(first?.uri).toBe("nbp://currencies/A");
    expect(first?.mimeType).toBe("application/json");
    const text = (first as { text: string }).text;
    expect(JSON.parse(text)).toEqual([
      { code: "USD", name: "US Dollar" },
      { code: "EUR", name: "Euro" },
    ]);
  });

  test("requests the correct NBP table per URI (B)", async () => {
    const installed = installFetch(() =>
      jsonResponse([
        {
          table: "B",
          no: "100/B/NBP/2026",
          effectiveDate: "2026-05-30",
          rates: [{ currency: "Afghan Afghani", code: "AFN", mid: 0.06 }],
        },
      ]),
    );

    await pair.client.readResource({ uri: "nbp://currencies/B" });
    expect(installed.calls).toHaveLength(1);
    expect(installed.calls[0]?.url).toContain("/exchangerates/tables/B/");
  });

  test("requests Table C per URI", async () => {
    const installed = installFetch(() =>
      jsonResponse([
        {
          table: "C",
          no: "100/C/NBP/2026",
          effectiveDate: "2026-05-30",
          rates: [{ currency: "US Dollar", code: "USD", bid: 3.95, ask: 4.05 }],
        },
      ]),
    );

    await pair.client.readResource({ uri: "nbp://currencies/C" });
    expect(installed.calls[0]?.url).toContain("/exchangerates/tables/C/");
  });

  test("propagates NbpApiError from the client (read fails)", () => {
    installFetch(() => new Response("Not Found", { status: 404 }));

    expect(
      pair.client.readResource({ uri: "nbp://currencies/A" }),
    ).rejects.toThrow();
  });

  test("client error is surfaced as Error, not as a success result", async () => {
    let captured: unknown;
    try {
      await client.getCurrencies("A");
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(NbpApiError);
  });
});

describe("nbp://meta/tables", () => {
  beforeEach(setup);

  test("returns static text describing the three tables", async () => {
    const result = await pair.client.readResource({
      uri: "nbp://meta/tables",
    });
    const first = result.contents[0];
    expect(first?.uri).toBe("nbp://meta/tables");
    expect(first?.mimeType).toBe("text/plain");
    const text = (first as { text: string }).text;
    expect(text).toContain("Table A");
    expect(text).toContain("Table B");
    expect(text).toContain("Table C");
    expect(text).toContain("bid");
  });

  test("does not call the NBP API", async () => {
    const installed = installFetch(() => jsonResponse({}));
    await pair.client.readResource({ uri: "nbp://meta/tables" });
    expect(installed.calls).toHaveLength(0);
  });
});

describe("nbp://meta/schedule", () => {
  beforeEach(setup);

  test("returns static text covering publication schedule and data limits", async () => {
    const result = await pair.client.readResource({
      uri: "nbp://meta/schedule",
    });
    const first = result.contents[0];
    expect(first?.uri).toBe("nbp://meta/schedule");
    expect(first?.mimeType).toBe("text/plain");
    const text = (first as { text: string }).text;
    expect(text).toContain("11:30");
    expect(text).toContain("2002-01-02");
    expect(text).toContain("2013-01-02");
    expect(text).toContain("93");
  });

  test("does not call the NBP API", async () => {
    const installed = installFetch(() => jsonResponse({}));
    await pair.client.readResource({ uri: "nbp://meta/schedule" });
    expect(installed.calls).toHaveLength(0);
  });
});
