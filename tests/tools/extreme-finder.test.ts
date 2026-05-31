// ABOUTME: Unit tests for runExtremeFinder — validates the shared driver in isolation
// ABOUTME: from the tool layer (no HTTP, fake fetchChunk) so chunking and error paths are
// ABOUTME: exercised without an MCP transport in the loop.

import {
  FIND_EXTREME_MAX_DAYS,
  HISTORY_CHUNK_DAYS,
  runExtremeFinder,
} from "#/tools/extreme-finder.js";
import type { SeriesPoint } from "#/tools/stats.js";
import { NbpApiError } from "#/types.js";
import { describe, expect, test } from "bun:test";

function fakeFetchChunk(points: SeriesPoint[][]) {
  const calls: Array<[string, string]> = [];
  let i = 0;
  const fn = (start: string, end: string): Promise<SeriesPoint[]> => {
    calls.push([start, end]);
    return Promise.resolve(points[i++] ?? []);
  };
  return { fn, calls };
}

describe("runExtremeFinder — validation", () => {
  test("returns an error result for a malformed start_date", async () => {
    const { fn } = fakeFetchChunk([]);
    const result = await runExtremeFinder({
      startDate: "01/15/2024",
      endDate: "2024-06-15",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/start_date/);
  });

  test("returns an error result when start_date > end_date", async () => {
    const { fn, calls } = fakeFetchChunk([]);
    const result = await runExtremeFinder({
      startDate: "2024-06-30",
      endDate: "2024-06-01",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/start_date/);
    expect(calls).toHaveLength(0);
  });

  test("rejects a range longer than FIND_EXTREME_MAX_DAYS", async () => {
    const { fn, calls } = fakeFetchChunk([]);
    const result = await runExtremeFinder({
      startDate: "2023-01-01",
      endDate: "2024-12-31",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(
      new RegExp(`${FIND_EXTREME_MAX_DAYS}`),
    );
    expect(calls).toHaveLength(0);
  });
});

describe("runExtremeFinder — chunking", () => {
  test("fetches once when the range fits inside HISTORY_CHUNK_DAYS", async () => {
    const { fn, calls } = fakeFetchChunk([
      [{ date: "2024-06-15", value: 4.0 }],
    ]);
    const result = await runExtremeFinder({
      startDate: "2024-06-01",
      endDate: "2024-06-30",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["2024-06-01", "2024-06-30"]);
  });

  test("splits a full-year range into ≤HISTORY_CHUNK_DAYS chunks", async () => {
    const { fn, calls } = fakeFetchChunk([
      [{ date: "2024-02-15", value: 3.9 }],
      [{ date: "2024-05-15", value: 4.1 }],
      [{ date: "2024-08-15", value: 4.3 }],
      [{ date: "2024-11-15", value: 4.0 }],
    ]);
    const result = await runExtremeFinder({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    expect(result.isError).toBeFalsy();
    expect(calls.length).toBeGreaterThan(1);
    // Boundary contract: first chunk starts at startDate, last ends at endDate.
    expect(calls[0]?.[0]).toBe("2024-01-01");
    expect(calls[calls.length - 1]?.[1]).toBe("2024-12-31");
    // Each chunk is at most HISTORY_CHUNK_DAYS days inclusive.
    for (const [start, end] of calls) {
      const startMs = new Date(start + "T00:00:00Z").getTime();
      const endMs = new Date(end + "T00:00:00Z").getTime();
      const inclusiveDays = (endMs - startMs) / (24 * 60 * 60 * 1000) + 1;
      expect(inclusiveDays).toBeLessThanOrEqual(HISTORY_CHUNK_DAYS);
    }
  });
});

describe("runExtremeFinder — aggregation and modes", () => {
  test("computes min and max across all chunks combined", async () => {
    const { fn } = fakeFetchChunk([
      [
        { date: "2024-02-01", value: 3.95 },
        { date: "2024-03-15", value: 4.2 }, // chunk-local max
      ],
      [
        { date: "2024-05-15", value: 3.7 }, // global min
        { date: "2024-06-15", value: 4.0 },
      ],
      [
        { date: "2024-08-15", value: 4.5 }, // global max
        { date: "2024-09-15", value: 4.1 },
      ],
      [{ date: "2024-11-15", value: 4.05 }],
    ]);
    const result = await runExtremeFinder({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    const text = result.content[0]?.text ?? "";
    expect(text).toMatch(/min:\s*3\.7(\s|$)/m);
    expect(text).toMatch(/minDate:\s*2024-05-15/);
    expect(text).toMatch(/max:\s*4\.5(\s|$)/m);
    expect(text).toMatch(/maxDate:\s*2024-08-15/);
    expect(text).toMatch(/dataPoints:\s*7/);
  });

  test("mode 'min' returns only min fields", async () => {
    const { fn } = fakeFetchChunk([
      [
        { date: "2024-06-01", value: 4.0 },
        { date: "2024-06-15", value: 3.85 },
      ],
    ]);
    const result = await runExtremeFinder({
      startDate: "2024-06-01",
      endDate: "2024-06-30",
      mode: "min",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    const text = result.content[0]?.text ?? "";
    expect(text).toMatch(/min:\s*3\.85/);
    expect(text).not.toMatch(/^max:/m);
    expect(text).not.toMatch(/^maxDate:/m);
  });

  test("mode 'max' returns only max fields", async () => {
    const { fn } = fakeFetchChunk([
      [
        { date: "2024-06-01", value: 4.0 },
        { date: "2024-06-15", value: 4.2 },
      ],
    ]);
    const result = await runExtremeFinder({
      startDate: "2024-06-01",
      endDate: "2024-06-30",
      mode: "max",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    const text = result.content[0]?.text ?? "";
    expect(text).toMatch(/max:\s*4\.2/);
    expect(text).not.toMatch(/^min:/m);
    expect(text).not.toMatch(/^minDate:/m);
  });
});

describe("runExtremeFinder — error and empty paths", () => {
  test("returns the configured emptyMessage when every chunk is empty", async () => {
    const { fn } = fakeFetchChunk([[], [], [], []]);
    const result = await runExtremeFinder({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no NBP data for the configured range",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(
      "no NBP data for the configured range",
    );
  });

  test("maps a thrown NbpApiError to a tool error result with the range context", async () => {
    let calls = 0;
    const fn = (): Promise<SeriesPoint[]> => {
      calls++;
      if (calls === 1)
        return Promise.resolve([{ date: "2024-02-15", value: 3.9 }]);
      throw new NbpApiError(500, "upstream down");
    };
    const result = await runExtremeFinder({
      startDate: "2024-01-01",
      endDate: "2024-06-30",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate", code: "USD" },
      emptyMessage: "no data",
    });
    expect(result.isError).toBe(true);
    // 500 falls through to formatNbpApiError's default branch.
    expect(result.content[0]?.text).toMatch(/500/);
    expect(result.content[0]?.text).toMatch(/upstream down/);
    // No min/dataPoints leaked from the successful first chunk.
    expect(result.content[0]?.text).not.toMatch(/min:/);
    expect(result.content[0]?.text).not.toMatch(/dataPoints:/);
  });

  test("re-throws errors that are not NbpApiError", () => {
    const fn = (): Promise<SeriesPoint[]> => {
      throw new TypeError("programmer error");
    };
    expect(
      runExtremeFinder({
        startDate: "2024-06-01",
        endDate: "2024-06-30",
        mode: "both",
        fetchChunk: fn,
        errorContext: { resource: "rate" },
        emptyMessage: "no data",
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  test("stops fetching at the first failing chunk", async () => {
    let calls = 0;
    const fn = (): Promise<SeriesPoint[]> => {
      calls++;
      throw new NbpApiError(500, "boom");
    };
    await runExtremeFinder({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      mode: "both",
      fetchChunk: fn,
      errorContext: { resource: "rate" },
      emptyMessage: "no data",
    });
    expect(calls).toBe(1);
  });
});
