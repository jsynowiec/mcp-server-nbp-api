// ABOUTME: Shared Zod primitives for tool input schemas — single source of truth for
// ABOUTME: currency, table, extreme, and skipCache parameter shapes and descriptions.

import { z } from "zod";

export const tableEnum = z.enum(["A", "B", "C"]);

export const midTableEnum = z.enum(["A", "B"]);

export const extremeEnum = z.enum(["min", "max", "both"]);

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "Expected a 3-letter ISO 4217 currency code");

export const skipCacheSchema = z
  .boolean()
  .optional()
  .describe(
    "Bypass the in-process cache and fetch a fresh value from NBP. Default: false.",
  );
