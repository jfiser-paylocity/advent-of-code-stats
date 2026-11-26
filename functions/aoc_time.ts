// Advent of Code calendar helpers. Pure, no Slack imports, unit tested.

/** Number of puzzle days in the event. */
export const EVENT_DAYS = 12;

export const DAY_SECONDS = 24 * 3600;

/** Puzzles unlock at 00:00 EST, which is 05:00 UTC in December. Returns seconds. */
export function publishTimestamp(year: number, day: number): number {
  // `Date.UTC` months are 0-indexed, so 11 is December.
  return Date.UTC(year, 11, day, 5) / 1000;
}

export type EventClock = {
  /** Event whose leaderboard is shown. */
  year: number;
  /** Puzzles unlocked so far, 1..EVENT_DAYS. */
  released: number;
  /** Puzzle day whose 24 hour window is open right now, if any. */
  today?: number;
};

/**
 * Event state at `nowMs`. Before this year's day 1 unlock, the latest event is
 * last year's, so a run outside December shows last year's final results.
 */
export function eventClock(nowMs: number): EventClock {
  const now = nowMs / 1000;
  const calendarYear = new Date(nowMs).getUTCFullYear();
  const year = now >= publishTimestamp(calendarYear, 1)
    ? calendarYear
    : calendarYear - 1;
  let released = 1;
  while (
    released < EVENT_DAYS && publishTimestamp(year, released + 1) <= now
  ) {
    released++;
  }
  const open = now < publishTimestamp(year, released) + DAY_SECONDS;
  return open ? { year, released, today: released } : { year, released };
}
