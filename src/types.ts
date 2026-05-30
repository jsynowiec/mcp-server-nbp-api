// ABOUTME: Domain types for NBP API responses after client-side normalization.
// ABOUTME: The HTTP layer (nbp-api.ts) maps raw NBP payloads to these shapes.

export type TableType = "A" | "B" | "C";

export interface RateEntry {
  currency: string;
  code: string;
  mid?: number;
  bid?: number;
  ask?: number;
}

export interface ExchangeTable {
  table: TableType;
  no: string;
  effectiveDate: string;
  rates: RateEntry[];
}

export interface ExchangeRateQuote {
  no: string;
  effectiveDate: string;
  mid?: number;
  bid?: number;
  ask?: number;
}

export interface ExchangeRate {
  table: TableType;
  currency: string;
  code: string;
  rates: ExchangeRateQuote[];
}

export interface GoldPrice {
  date: string;
  price: number;
}

export class NbpApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "NbpApiError";
    this.statusCode = statusCode;
  }
}
