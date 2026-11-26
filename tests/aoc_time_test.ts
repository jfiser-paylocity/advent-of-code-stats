import { eventClock, publishTimestamp } from "../functions/aoc_time.ts";

function assertEquals<T>(actual: T, expected: T, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg} Expected ${e} but got ${a}`);
  }
}

Deno.test("publishTimestamp is 05:00 UTC", () => {
  assertEquals(publishTimestamp(2025, 1), 1764565200);
});

Deno.test("eventClock", () => {
  const cases: [string, ReturnType<typeof eventClock>][] = [
    // Before the event: last year's final results.
    ["2026-11-26T12:00:00Z", { year: 2025, released: 12 }],
    ["2026-12-01T04:59:59Z", { year: 2025, released: 12 }],
    // Puzzle unlocks at 05:00 UTC, its window lasts 24 hours.
    ["2026-12-01T05:00:00Z", { year: 2026, released: 1, today: 1 }],
    ["2026-12-01T21:00:00Z", { year: 2026, released: 1, today: 1 }],
    ["2026-12-02T04:59:59Z", { year: 2026, released: 1, today: 1 }],
    ["2026-12-02T05:00:00Z", { year: 2026, released: 2, today: 2 }],
    // Last day still has a "today", the day after does not.
    ["2026-12-12T21:00:00Z", { year: 2026, released: 12, today: 12 }],
    ["2026-12-13T04:59:59Z", { year: 2026, released: 12, today: 12 }],
    ["2026-12-13T05:00:00Z", { year: 2026, released: 12 }],
    ["2026-12-31T23:59:59Z", { year: 2026, released: 12 }],
    // New calendar year: still the previous event.
    ["2027-01-05T12:00:00Z", { year: 2026, released: 12 }],
  ];
  for (const [iso, expected] of cases) {
    assertEquals(eventClock(Date.parse(iso)), expected, iso);
  }
});
