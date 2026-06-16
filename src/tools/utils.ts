// ABOUTME: Date utilities shared by tool handlers.
// ABOUTME: Range chunking for the NBP 93-day API limit, Warsaw-local "today", and date validation.

import { err, type ToolResult } from "#/tools/result.js";

export const RATES_START_DATE = "2002-01-02";
export const GOLD_START_DATE = "2013-01-02";

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
  // Exponential-notation shift avoids the IEEE 754 trap where factor-multiply
  // (e.g. 1.255 * 100 = 125.4999...) causes naive Math.round to round the wrong way.
  return Number(Math.round(Number(`${value}e${decimals}`)) + `e-${decimals}`);
}

export function checkDates(
  ...entries: Array<
    [string | undefined, string] | [string | undefined, string, string]
  >
): ToolResult | undefined {
  for (const [date, field, minDate] of entries) {
    if (date === undefined) continue;
    try {
      validateDate(date, field, minDate);
    } catch (e) {
      return err((e as Error).message);
    }
  }
  return undefined;
}

export function validateDate(
  date: string,
  fieldName: string,
  minDate?: string,
): void {
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

  if (minDate && date < minDate) {
    throw new Error(
      `Date '${date}' for '${fieldName}' is before the earliest available data (${minDate}).`,
    );
  }
}
