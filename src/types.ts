// ABOUTME: Domain types for NBP API responses after client-side normalization.
// ABOUTME: The HTTP layer (nbp-api.ts) maps raw NBP payloads to these shapes.

export type TableType = "A" | "B" | "C";
export const CURRENCY_MAP = {
  A: [
    "AUD",
    "BRL",
    "CAD",
    "CHF",
    "CLP",
    "CNY",
    "CZK",
    "DKK",
    "EUR",
    "GBP",
    "HKD",
    "HUF",
    "IDR",
    "ILS",
    "INR",
    "ISK",
    "JPY",
    "KRW",
    "MXN",
    "MYR",
    "NOK",
    "NZD",
    "PHP",
    "RON",
    "SEK",
    "SGD",
    "THB",
    "TRY",
    "UAH",
    "USD",
    "XDR",
    "ZAR",
  ],
  B: [
    "AED",
    "AFN",
    "ALL",
    "AMD",
    "AOA",
    "ARS",
    "AWG",
    "AZN",
    "BAM",
    "BBD",
    "BDT",
    "BHD",
    "BIF",
    "BND",
    "BOB",
    "BSD",
    "BWP",
    "BYN",
    "BZD",
    "CDF",
    "COP",
    "CRC",
    "CUP",
    "CVE",
    "DJF",
    "DOP",
    "DZD",
    "EGP",
    "ERN",
    "ETB",
    "FJD",
    "GEL",
    "GHS",
    "GIP",
    "GMD",
    "GNF",
    "GTQ",
    "GYD",
    "HNL",
    "HTG",
    "IQD",
    "IRR",
    "JMD",
    "JOD",
    "KES",
    "KGS",
    "KHR",
    "KMF",
    "KWD",
    "KZT",
    "LAK",
    "LBP",
    "LKR",
    "LRD",
    "LSL",
    "LYD",
    "MAD",
    "MDL",
    "MGA",
    "MKD",
    "MMK",
    "MNT",
    "MOP",
    "MRU",
    "MUR",
    "MVR",
    "MWK",
    "MZN",
    "NAD",
    "NGN",
    "NIO",
    "NPR",
    "OMR",
    "PAB",
    "PEN",
    "PGK",
    "PKR",
    "PYG",
    "QAR",
    "RSD",
    "RUB",
    "RWF",
    "SAR",
    "SBD",
    "SCR",
    "SDG",
    "SLE",
    "SOS",
    "SRD",
    "SSP",
    "STN",
    "SVC",
    "SYP",
    "SZL",
    "TJS",
    "TMT",
    "TND",
    "TOP",
    "TTD",
    "TWD",
    "TZS",
    "UGX",
    "UYU",
    "UZS",
    "VES",
    "VND",
    "VUV",
    "WST",
    "XAF",
    "XCD",
    "XCG",
    "XOF",
    "XPF",
    "YER",
    "ZMW",
    "ZWG",
  ],
  C: [
    "AUD",
    "CAD",
    "CHF",
    "CZK",
    "DKK",
    "EUR",
    "GBP",
    "HUF",
    "JPY",
    "NOK",
    "SEK",
    "USD",
    "XDR",
  ],
} as const satisfies Record<TableType, readonly string[]>;

export type TableTypeCurrencyCode = {
  [K in TableType]: (typeof CURRENCY_MAP)[K][number];
};

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

export interface CurrencyListing {
  code: string;
  name: string;
}

export class NbpApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "NbpApiError";
    this.statusCode = statusCode;
  }
}
