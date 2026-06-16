// ABOUTME: Unit tests for date utilities used by tool handlers.
// ABOUTME: Covers range chunking, Warsaw-local "today", and date validation.

import {
  checkDates,
  chunkDateRange,
  daysInclusive,
  getWarsawToday,
  GOLD_START_DATE,
  RATES_START_DATE,
  round,
  validateDate,
} from "#/tools/utils.js";
import { warsawTomorrow } from "#tests/helpers/dates.js";
import { describe, expect, test } from "bun:test";

describe("round", () => {
  test("rounds down when fractional digit is less than 5", () => {
    expect(round(3.142, 2)).toBe(3.14);
  });

  test("rounds up when fractional digit is greater than 5", () => {
    expect(round(3.147, 2)).toBe(3.15);
  });

  test("rounds .5 up (not banker's rounding)", () => {
    expect(round(3.145, 2)).toBe(3.15);
  });

  test("rounds .5 up even when IEEE 754 stores the value slightly below the midpoint", () => {
    // 1.255 is stored as 1.25499999... in IEEE 754 double precision.
    // Naive factor-multiply (1.255 * 100 = 125.49999...) rounds to 1.25 (wrong).
    expect(round(1.255, 2)).toBe(1.26);
    // 1.005 * 100 = 100.49999... — same trap.
    expect(round(1.005, 2)).toBe(1.01);
  });
});

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

describe("daysInclusive", () => {
  test("returns 1 for the same start and end date", () => {
    expect(daysInclusive("2024-06-15", "2024-06-15")).toBe(1);
  });

  test("returns 93 for a 93-day inclusive range", () => {
    expect(daysInclusive("2024-01-01", "2024-04-02")).toBe(93);
  });

  test("returns 366 for a full leap year", () => {
    expect(daysInclusive("2024-01-01", "2024-12-31")).toBe(366);
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
    expect(() => {
      validateDate(warsawTomorrow(), "date");
    }).toThrow(/future/);
  });

  test("includes the field name in the thrown error", () => {
    expect(() => {
      validateDate("not-a-date", "start_date");
    }).toThrow(/start_date/);
  });

  test("rejects a date before RATES_START_DATE when minDate is provided", () => {
    expect(() => {
      validateDate("2001-12-31", "date", RATES_START_DATE);
    }).toThrow(/2002-01-02/);
  });

  test("rejects a date before GOLD_START_DATE when minDate is provided", () => {
    expect(() => {
      validateDate("2012-12-31", "date", GOLD_START_DATE);
    }).toThrow(/2013-01-02/);
  });

  test("accepts a date exactly at the minDate floor", () => {
    expect(() => {
      validateDate(RATES_START_DATE, "date", RATES_START_DATE);
    }).not.toThrow();
  });
});

describe("checkDates", () => {
  test("returns undefined when called with no entries", () => {
    expect(checkDates()).toBeUndefined();
  });

  test("returns undefined when every supplied date is undefined", () => {
    expect(
      checkDates([undefined, "date"], [undefined, "other"]),
    ).toBeUndefined();
  });

  test("returns undefined when every supplied date is valid", () => {
    expect(
      checkDates(["2024-01-15", "start_date"], ["2024-06-15", "end_date"]),
    ).toBeUndefined();
  });

  test("returns a tool error result for a malformed date", () => {
    const result = checkDates(["27-06-2024", "date"]);
    expect(result).toBeDefined();
    expect(result?.isError).toBe(true);
    const text = result?.content[0]?.text ?? "";
    expect(text).toMatch(/Invalid date/);
    expect(text).toMatch(/'date'/);
  });

  test("returns the error for the first invalid entry and ignores later ones", () => {
    const result = checkDates(["nope", "start_date"], ["also-bad", "end_date"]);
    const text = result?.content[0]?.text ?? "";
    expect(text).toMatch(/start_date/);
    expect(text).not.toMatch(/end_date/);
  });

  test("skips undefined entries and still validates the rest", () => {
    const result = checkDates(
      [undefined, "start_date"],
      ["2099-13-99", "end_date"],
    );
    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text ?? "").toMatch(/end_date/);
  });

  test("flags a future date with the future-date message", () => {
    const result = checkDates([warsawTomorrow(), "date"]);
    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text ?? "").toMatch(/future/);
  });
});
