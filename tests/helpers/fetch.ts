// ABOUTME: Test helpers for installing a mocked globalThis.fetch and reading captured calls.
// ABOUTME: Returns a JSON response builder and a fetch installer that records every invocation.

import { mock } from "bun:test";

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

export interface MockCall {
  url: string;
  init: FetchInit;
}

export interface InstalledFetch {
  calls: MockCall[];
  fn: ReturnType<typeof mock>;
}

export function installFetch(
  handler: (url: string) => Response | Promise<Response>,
): InstalledFetch {
  const calls: MockCall[] = [];
  const fn = mock(async (input: FetchInput, init?: FetchInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return handler(url);
  });
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return { calls, fn };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
