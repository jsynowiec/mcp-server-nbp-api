// ABOUTME: Generic min/max/avg/change computation over time-stamped numeric series.
// ABOUTME: Used by rate and gold history tools; callers map their typed series to {date, value}.

import { type ExtremeStats, type HistoryStats } from "#/tools/format.js";
import { round } from "#/tools/utils.js";

export interface SeriesPoint {
  date: string;
  value: number;
}

export function computeHistoryStats(series: SeriesPoint[]): HistoryStats {
  const first = series[0]!;
  const last = series[series.length - 1]!;

  let min = first.value;
  let max = first.value;
  let minDate = first.date;
  let maxDate = first.date;
  let sum = 0;

  for (const point of series) {
    if (point.value < min) {
      min = point.value;
      minDate = point.date;
    }
    if (point.value > max) {
      max = point.value;
      maxDate = point.date;
    }
    sum += point.value;
  }

  const avg = round(sum / series.length, 4);
  const pct = ((last.value - first.value) / first.value) * 100;
  const sign = pct >= 0 ? "+" : "";
  const change = `${sign}${pct.toFixed(2)}% (${first.date} → ${last.date})`;

  return { min, minDate, max, maxDate, avg, change };
}

export function computeExtremeStats(
  series: SeriesPoint[],
  mode: "min" | "max" | "both",
): ExtremeStats {
  const first = series[0]!;
  let min = first.value;
  let max = first.value;
  let minDate = first.date;
  let maxDate = first.date;

  for (const point of series) {
    if (point.value < min) {
      min = point.value;
      minDate = point.date;
    }
    if (point.value > max) {
      max = point.value;
      maxDate = point.date;
    }
  }

  const dataPoints = series.length;
  if (mode === "min") {
    return { min, minDate, dataPoints };
  }
  if (mode === "max") {
    return { max, maxDate, dataPoints };
  }
  return { min, minDate, max, maxDate, dataPoints };
}
