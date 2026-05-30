// ABOUTME: Maps NbpApiError instances to user-facing tool result text.
// ABOUTME: Centralizes the wording the LLM sees so hints stay consistent across tools.

import { getWarsawToday } from "#/tools/utils.js";
import type { TableType } from "#/types.js";
import { NbpApiError } from "#/types.js";

export interface NbpErrorContext {
  resource: "rate" | "table" | "gold";
  table?: TableType;
  code?: string;
  date?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export function formatNbpApiError(
  err: NbpApiError,
  context: NbpErrorContext,
): string {
  const { resource, table, code, date, rangeStart, rangeEnd } = context;

  if (err.statusCode === 404) {
    if (resource === "rate" && code && !date && !rangeStart) {
      return `Currency '${code}' not found in Table ${table ?? "A"}. Use list_currencies to see available codes.`;
    }
    if (date && date === getWarsawToday()) {
      return `Today's rates not yet published (NBP typically publishes around 11:30 CET). Omit the date to get the most recent available rates.`;
    }
    if (date) {
      return `No NBP data for ${date}. NBP publishes on business days only (Mon–Fri, excluding Polish public holidays). Try the nearest preceding business day.`;
    }
    if (rangeStart && rangeEnd) {
      return `No NBP data in the range ${rangeStart} → ${rangeEnd}. NBP publishes on business days only and the requested range may include no published values.`;
    }
    return `NBP returned 404 Not Found for the requested ${resource}.`;
  }

  if (err.statusCode === 400) {
    return `NBP API rejected the request: ${err.message}`;
  }

  if (err.statusCode === 0) {
    return `NBP API network error: ${err.message}. Try again.`;
  }

  return `NBP API error (${err.statusCode}): ${err.message}`;
}
