// ABOUTME: Unit tests for date utilities used by tool handlers.
// ABOUTME: Covers range chunking, Warsaw-local "today", and date validation.

import { describe, expect, test } from "bun:test";
import {
  chunkDateRange,
  getWarsawToday,
  validateDate,
} from "../../tools/utils.js";

describe("chunkDateRange", () => {
  test("returns one chunk when the range fits within maxDays", () => {
    const chunks = chunkDateRange("2024-01-01", "2024-01-10", 93);
    expect(chunks).toEqual([["2024-01-01", "2024-01-10"]]);
  });

  test("returns one chunk when the range is exactly maxDays days inclusive", () => {
    const chunks = chunkDateRange("2024-01-01", "2024-04-02", 93);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(["2024-01-01", "2024-04-02"]);
  });

  test("splits when the range exceeds maxDays, with contiguous non-overlapping chunks", () => {
    const chunks = chunkDateRange("2024-01-01", "2024-12-31", 93);
    expect(chunks.length).toBeGreaterThan(1);

    const first = chunks[0]!;
    const last = chunks[chunks.length - 1]!;
    expect(first[0]).toBe("2024-01-01");
    expect(last[1]).toBe("2024-12-31");

    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1]!;
      const cur = chunks[i]!;
      const prevEnd = new Date(prev[1] + "T00:00:00Z");
      const curStart = new Date(cur[0] + "T00:00:00Z");
      const gapMs = curStart.getTime() - prevEnd.getTime();
      expect(gapMs).toBe(24 * 60 * 60 * 1000);
    }

    for (const [chunkStart, chunkEnd] of chunks) {
      const startMs = new Date(chunkStart + "T00:00:00Z").getTime();
      const endMs = new Date(chunkEnd + "T00:00:00Z").getTime();
      const inclusiveDays = (endMs - startMs) / (24 * 60 * 60 * 1000) + 1;
      expect(inclusiveDays).toBeLessThanOrEqual(93);
    }
  });

  test("returns a single-day chunk when start equals end", () => {
    const chunks = chunkDateRange("2024-06-15", "2024-06-15", 93);
    expect(chunks).toEqual([["2024-06-15", "2024-06-15"]]);
  });
});

describe("getWarsawToday", () => {
  test("returns a string in YYYY-MM-DD format", () => {
    const today = getWarsawToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("matches the date currently displayed by Intl in Europe/Warsaw", () => {
    const today = getWarsawToday();
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    expect(today).toBe(expected);
  });
});

describe("validateDate", () => {
  test("accepts a well-formed past date", () => {
    expect(() => {
      validateDate("2024-01-15", "date");
    }).not.toThrow();
  });

  test("rejects a date that is not YYYY-MM-DD", () => {
    expect(() => {
      validateDate("01/15/2024", "date");
    }).toThrow(/Invalid date/);
  });

  test("rejects a date with the right shape but invalid month", () => {
    expect(() => {
      validateDate("2024-13-01", "date");
    }).toThrow(/Invalid date/);
  });

  test("rejects an impossible calendar date (Feb 30)", () => {
    expect(() => {
      validateDate("2024-02-30", "date");
    }).toThrow(/Invalid date/);
  });

  test("rejects a date in the future relative to Warsaw today", () => {
    const tomorrowWarsaw = (() => {
      const today = getWarsawToday();
      const d = new Date(today + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    expect(() => {
      validateDate(tomorrowWarsaw, "date");
    }).toThrow(/future/);
  });

  test("includes the field name in the thrown error", () => {
    expect(() => {
      validateDate("not-a-date", "start_date");
    }).toThrow(/start_date/);
  });
});
