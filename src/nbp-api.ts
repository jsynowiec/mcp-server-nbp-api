// ABOUTME: HTTP client for the NBP Web API with an LRU read-through cache.
// ABOUTME: Normalizes raw NBP payloads to the domain types in src/types.ts.

import type {
  CurrencyListing,
  ExchangeRate,
  ExchangeTable,
  GoldPrice,
  RateEntry,
  TableType,
} from "#/types.js";
import { NbpApiError } from "#/types.js";
import { LRUCache } from "lru-cache";

const BASE_URL = "https://api.nbp.pl/api";
const CACHE_MAX_ENTRIES = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface RawExchangeTable {
  table: TableType;
  no: string;
  effectiveDate: string;
  rates: RateEntry[];
}

interface RawGoldPrice {
  data: string;
  cena: number;
}

export interface RequestOptions {
  skipCache?: boolean;
}

type CachedValue = NonNullable<unknown>;

export class NbpApiClient {
  private readonly cache: LRUCache<string, CachedValue>;

  constructor() {
    this.cache = new LRUCache<string, CachedValue>({
      max: CACHE_MAX_ENTRIES,
      ttl: CACHE_TTL_MS,
    });
  }

  private static assertValidCode(code: string): void {
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new Error(
        `invalid currency code '${code}': must be exactly 3 ASCII letters`,
      );
    }
  }

  private static assertValidDate(date: string, label: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`invalid ${label} '${date}': must be YYYY-MM-DD`);
    }
  }

  async getExchangeTable(
    table: TableType,
    date?: string,
    options?: RequestOptions,
  ): Promise<ExchangeTable> {
    if (date !== undefined) NbpApiClient.assertValidDate(date, "date");
    const path = date
      ? `/exchangerates/tables/${table}/${date}/`
      : `/exchangerates/tables/${table}/`;
    const payload = await this.request<RawExchangeTable[]>(path, options);
    const entry = payload[0];
    if (!entry) {
      throw new NbpApiError(
        502,
        `NBP returned an empty exchange-table payload for ${path}`,
      );
    }
    return entry;
  }

  async getCurrencies(
    table: TableType,
    options?: RequestOptions,
  ): Promise<CurrencyListing[]> {
    const snapshot = await this.getExchangeTable(table, undefined, options);
    return snapshot.rates.map((rate) => ({
      code: rate.code,
      name: rate.currency,
    }));
  }

  async getExchangeRate(
    table: TableType,
    code: string,
    date?: string,
    options?: RequestOptions,
  ): Promise<ExchangeRate> {
    const upperCode = code.toUpperCase();
    NbpApiClient.assertValidCode(upperCode);
    if (date !== undefined) NbpApiClient.assertValidDate(date, "date");
    const path = date
      ? `/exchangerates/rates/${table}/${upperCode}/${date}/`
      : `/exchangerates/rates/${table}/${upperCode}/`;
    return this.request<ExchangeRate>(path, options);
  }

  async getExchangeRateHistory(
    table: TableType,
    code: string,
    startDate: string,
    endDate: string,
    options?: RequestOptions,
  ): Promise<ExchangeRate> {
    const upperCode = code.toUpperCase();
    NbpApiClient.assertValidCode(upperCode);
    NbpApiClient.assertValidDate(startDate, "startDate");
    NbpApiClient.assertValidDate(endDate, "endDate");
    const path = `/exchangerates/rates/${table}/${upperCode}/${startDate}/${endDate}/`;
    return this.request<ExchangeRate>(path, options);
  }

  async getGoldPrice(
    date?: string,
    options?: RequestOptions,
  ): Promise<GoldPrice> {
    if (date !== undefined) NbpApiClient.assertValidDate(date, "date");
    const path = date ? `/cenyzlota/${date}/` : `/cenyzlota/`;
    const payload = await this.request<RawGoldPrice[]>(path, options);
    const entry = payload[0];
    if (!entry) {
      throw new NbpApiError(
        502,
        `NBP returned an empty gold payload for ${path}`,
      );
    }
    return { date: entry.data, price: entry.cena };
  }

  async getGoldPriceHistory(
    startDate: string,
    endDate: string,
    options?: RequestOptions,
  ): Promise<GoldPrice[]> {
    NbpApiClient.assertValidDate(startDate, "startDate");
    NbpApiClient.assertValidDate(endDate, "endDate");
    const path = `/cenyzlota/${startDate}/${endDate}/`;
    const payload = await this.request<RawGoldPrice[]>(path, options);
    return payload.map((entry) => ({ date: entry.data, price: entry.cena }));
  }

  private async request<T>(path: string, options?: RequestOptions): Promise<T> {
    const skipCache = options?.skipCache ?? false;

    if (!skipCache) {
      const cached = this.cache.get(path);
      if (cached !== undefined) {
        return cached as T;
      }
    }

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        headers: { accept: "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new NbpApiError(0, `NBP API network error: ${message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new NbpApiError(
        response.status,
        body.trim() || response.statusText,
      );
    }

    let data: T;
    try {
      data = (await response.json()) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new NbpApiError(502, `invalid JSON from NBP: ${msg}`);
    }
    const isEmptyArray = Array.isArray(data) && data.length === 0;
    if (!skipCache && !isEmptyArray) {
      this.cache.set(path, data as CachedValue);
    }
    return data;
  }
}
