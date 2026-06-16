// ABOUTME: Shared driver for find_*_extreme tools: validates the range, chunks it under
// ABOUTME: the 93-day NBP limit, fetches sequentially, fails fast, and formats the result.

import { formatNbpApiError, type NbpErrorContext } from "#/tools/errors.js";
import { formatExtremeResponse } from "#/tools/format.js";
import { err, ok, type ToolResult } from "#/tools/result.js";
import { computeExtremeStats, type SeriesPoint } from "#/tools/stats.js";
import { checkDates, chunkDateRange, daysInclusive } from "#/tools/utils.js";
import { NbpApiError } from "#/types.js";

export const FIND_EXTREME_MAX_DAYS = 366;
export const HISTORY_CHUNK_DAYS = 93;

export interface ExtremeFinderConfig {
  startDate: string;
  endDate: string;
  mode: "min" | "max" | "both";
  fetchChunk: (chunkStart: string, chunkEnd: string) => Promise<SeriesPoint[]>;
  errorContext: Omit<NbpErrorContext, "rangeStart" | "rangeEnd">;
  emptyMessage: string;
  minDate?: string;
}

export async function runExtremeFinder(
  config: ExtremeFinderConfig,
): Promise<ToolResult> {
  const {
    startDate,
    endDate,
    mode,
    fetchChunk,
    errorContext,
    emptyMessage,
    minDate,
  } = config;

  const dateError = checkDates(
    [startDate, "start_date", minDate],
    [endDate, "end_date", minDate],
  );
  if (dateError) return dateError;

  if (startDate > endDate) {
    return err(
      `start_date '${startDate}' must be on or before end_date '${endDate}'.`,
    );
  }

  const span = daysInclusive(startDate, endDate);
  if (span > FIND_EXTREME_MAX_DAYS) {
    return err(
      `Date range of ${span} days exceeds the ${FIND_EXTREME_MAX_DAYS}-day limit for this tool.`,
    );
  }

  const chunks = chunkDateRange(startDate, endDate, HISTORY_CHUNK_DAYS);
  const series: SeriesPoint[] = [];

  try {
    for (const [chunkStart, chunkEnd] of chunks) {
      const points = await fetchChunk(chunkStart, chunkEnd);
      series.push(...points);
    }
  } catch (e) {
    if (e instanceof NbpApiError) {
      return err(
        formatNbpApiError(e, {
          ...errorContext,
          rangeStart: startDate,
          rangeEnd: endDate,
        }),
      );
    }
    throw e;
  }

  if (series.length === 0) {
    return err(emptyMessage);
  }

  return ok(formatExtremeResponse(computeExtremeStats(series, mode)));
}
