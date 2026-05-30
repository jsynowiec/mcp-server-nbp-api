// ABOUTME: Date utilities shared by tool handlers.
// ABOUTME: Range chunking for the NBP 93-day API limit, Warsaw-local "today", and date validation.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const warsawDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseIsoDate(value: string): Date {
  return new Date(value + "T00:00:00Z");
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function chunkDateRange(
  start: string,
  end: string,
  maxDays: number,
): [string, string][] {
  const chunks: [string, string][] = [];
  const endDate = parseIsoDate(end);
  let cursor = parseIsoDate(start);

  while (cursor.getTime() <= endDate.getTime()) {
    const chunkEnd = new Date(cursor.getTime() + (maxDays - 1) * ONE_DAY_MS);
    const cappedEnd =
      chunkEnd.getTime() > endDate.getTime() ? endDate : chunkEnd;
    chunks.push([formatIsoDate(cursor), formatIsoDate(cappedEnd)]);
    cursor = new Date(cappedEnd.getTime() + ONE_DAY_MS);
  }

  return chunks;
}

export function getWarsawToday(): string {
  return warsawDateFormatter.format(new Date());
}

export function daysInclusive(start: string, end: string): number {
  const startMs = parseIsoDate(start).getTime();
  const endMs = parseIsoDate(end).getTime();
  return Math.round((endMs - startMs) / ONE_DAY_MS) + 1;
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function validateDate(date: string, fieldName: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(
      `Invalid date '${date}' for '${fieldName}'. Expected YYYY-MM-DD calendar date.`,
    );
  }

  const parsed = parseIsoDate(date);
  if (Number.isNaN(parsed.getTime()) || formatIsoDate(parsed) !== date) {
    throw new Error(
      `Invalid date '${date}' for '${fieldName}'. Expected YYYY-MM-DD calendar date.`,
    );
  }

  if (date > getWarsawToday()) {
    throw new Error(
      `Date '${date}' for '${fieldName}' is in the future. NBP only publishes historical rates.`,
    );
  }
}
