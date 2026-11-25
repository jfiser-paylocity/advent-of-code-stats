import {
  biggestGain,
  buildFunFacts,
  fastestJumpToday,
  fastestPart1Record,
  fastestPart2Record,
  formatDuration,
  FunFactMember,
  hardestDay,
  publishTimestamp,
  streakLeaders,
  topThree,
} from "../functions/fun_facts.ts";

function assertEquals<T>(actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected ${e} but got ${a}`);
  }
}

const YEAR = 2025;
const publish = (day: number) => publishTimestamp(YEAR, day);

const alice: FunFactMember = {
  name: "Alice",
  stars: 4,
  local_score: 50,
  completion_day_level: [
    {
      day: 1,
      star_1_timestamp: publish(1) + 600,
      star_2_timestamp: publish(1) + 600 + 300,
    },
    {
      day: 2,
      star_1_timestamp: publish(2) + 120,
      star_2_timestamp: publish(2) + 120 + 41,
    },
  ],
};
const bob: FunFactMember = {
  stars: 3,
  local_score: 70,
  completion_day_level: [
    {
      day: 1,
      star_1_timestamp: publish(1) + 7200,
      star_2_timestamp: publish(1) + 7200 + 3600,
    },
    { day: 2, star_1_timestamp: publish(2) + 90 },
  ],
};
const members = [alice, bob];

Deno.test("formatDuration", () => {
  assertEquals(formatDuration(41), "41 s");
  assertEquals(formatDuration(300), "5 min");
  assertEquals(formatDuration(3600), "1h");
  assertEquals(formatDuration(3 * 3600 + 12 * 60), "3h 12m");
});

Deno.test("publishTimestamp is 05:00 UTC", () => {
  assertEquals(publishTimestamp(2025, 1), 1764565200);
});

Deno.test("fastest part 1 record uses publish time", () => {
  assertEquals(
    fastestPart1Record(members, YEAR),
    "🥇 Fastest part 1 this year: *Anonymous*, 1 min (day 2).",
  );
});

Deno.test("fastest part 2 record uses star gap", () => {
  assertEquals(
    fastestPart2Record(members),
    "🥈 Fastest part 2 this year: *Alice*, 41 s (day 2).",
  );
});

Deno.test("fastest jump only looks at the given day", () => {
  assertEquals(
    fastestJumpToday(members, 1),
    "⚡ Fastest jump from ⭐ to ⭐⭐ today: *Alice*, 5 min.",
  );
  assertEquals(fastestJumpToday([bob], 2), undefined);
});

Deno.test("biggest gain counts stars in last 24h and breaks ties by day", () => {
  const now = (publish(2) + 3600) * 1000;
  // Day 2 part 1 has 2 new stars, everything else fewer.
  assertEquals(
    biggestGain(members, now),
    "📈 Biggest gain of the day: day 2 part 1, +2 new stars.",
  );
  assertEquals(
    biggestGain(members, (publish(2) + 10 * 86400) * 1000),
    undefined,
  );
});

Deno.test("streak needs at least 2 days and tolerates unsolved today", () => {
  assertEquals(
    streakLeaders(members, 3),
    "🔥 *Alice* has a streak of 2 days with both stars.",
  );
  assertEquals(streakLeaders([bob], 2), undefined);
});

Deno.test("hardest day is the one with the biggest silver-gold gap", () => {
  assertEquals(
    hardestDay(members, 2),
    "🧱 Toughest part 2 so far: day 2, only 50% solved it.",
  );
  assertEquals(hardestDay([], 2), undefined);
});

Deno.test("top three ranks by local score", () => {
  assertEquals(topThree(members), "🏆 Top 2: Anonymous 70, Alice 50");
  assertEquals(topThree([]), undefined);
});

Deno.test("buildFunFacts skips facts without data", () => {
  assertEquals(buildFunFacts([], { day: 1, year: YEAR, now: 0 }), []);
});
