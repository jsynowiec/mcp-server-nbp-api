// ABOUTME: Test helper for computing a YYYY-MM-DD date that is always one day after
// ABOUTME: Warsaw "today", so future-date tests stay valid as wall-clock time advances.

import { getWarsawToday } from "#/tools/utils.js";

export function warsawTomorrow(): string {
  const today = getWarsawToday();
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
