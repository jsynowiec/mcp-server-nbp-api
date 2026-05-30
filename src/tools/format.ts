// ABOUTME: TOON formatting helpers for tool responses.
// ABOUTME: Centralizes encoding so tool handlers never assemble TOON strings directly.

import type { CurrencyListing, TableType } from "#/types.js";
import { encode } from "@toon-format/toon";

export interface HistoryStats {
  min: number;
  minDate: string;
  max: number;
  maxDate: string;
  avg: number;
  change: string;
}

export interface ExtremeStats {
  min?: number;
  minDate?: string;
  max?: number;
  maxDate?: string;
  dataPoints: number;
}

export interface RateSeriesPoint {
  date: string;
  mid: number;
}

export interface GoldSeriesPoint {
  date: string;
  price: number;
}

export type HistorySeries =
  | { rates: RateSeriesPoint[] }
  | { prices: GoldSeriesPoint[] };

export function formatHistoryResponse(
  stats: HistoryStats,
  series: HistorySeries,
): string {
  return encode({ stats, ...series });
}

export function formatExtremeResponse(stats: ExtremeStats): string {
  return encode({ stats: stripUndefined(stats) });
}

export interface ConversionView {
  amount: number;
  from: string;
  to: string;
  rate: number;
  result: number;
  effectiveDate: string | null;
  sourceMid?: number;
  targetMid?: number;
  note?: string;
}

export function formatConversion(view: ConversionView): string {
  return encode(stripUndefined(view));
}

export interface RateView {
  table: TableType;
  code: string;
  currency: string;
  mid: number;
  effectiveDate: string;
  amount?: number;
  plnValue?: number;
}

export function formatRate(entry: RateView): string {
  return encode(stripUndefined(entry));
}

export interface BidAskView {
  table: "C";
  code: string;
  currency: string;
  bid: number;
  ask: number;
  spread: number;
  effectiveDate: string;
  amount?: number;
  totalBuyPln?: number;
  totalSellPln?: number;
}

export function formatBidAsk(entry: BidAskView): string {
  return encode(stripUndefined(entry));
}

export interface MidTableRow {
  code: string;
  currency: string;
  mid: number;
}

export interface BidAskTableRow {
  code: string;
  currency: string;
  bid: number;
  ask: number;
}

export interface TableView {
  table: TableType;
  effectiveDate: string;
  rows: MidTableRow[] | BidAskTableRow[];
}

export function formatTable(view: TableView): string {
  return encode(view);
}

export interface GoldPriceView {
  date: string;
  pricePerGram: number;
  amountGrams?: number;
  totalPln?: number;
}

export function formatGoldPrice(view: GoldPriceView): string {
  return encode(stripUndefined(view));
}

export function formatCurrencyList(currencies: CurrencyListing[]): string {
  return encode(currencies);
}

export interface ComparisonView {
  table: TableType;
  effectiveDate: string;
  rows: MidTableRow[];
  missing?: string[];
}

export function formatComparison(view: ComparisonView): string {
  const header = `table: ${view.table}\neffectiveDate: ${view.effectiveDate}\n`;
  let text = header + encode(view.rows);
  if (view.missing && view.missing.length > 0) {
    text += `\n\nNot found in Table ${view.table}: ${view.missing.join(", ")} — use list_currencies to see available codes.`;
  }
  return text;
}

function stripUndefined(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
