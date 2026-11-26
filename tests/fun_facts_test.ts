import {
  biggestGain,
  buildFunFacts,
  fastestJumpToday,
  fastestPart1Record,
  fastestPart2Record,
  formatDuration,
  hardestDay,
  nonParticipants,
  streakLeaders,
  topThree,
} from "../functions/fun_facts.ts";
import { publishTimestamp } from "../functions/aoc_time.ts";
import type { Member } from "../functions/members.ts";

function assertEquals<T>(actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected ${e} but got ${a}`);
  }
}

const YEAR = 2025;
const publish = (day: number) => publishTimestamp(YEAR, day);

const alice: Member = {
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
const bob: Member = {
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

Deno.test("fastest jump only counts jumps since today's publish time", () => {
  const options = { day: 1, year: YEAR, now: (publish(1) + 3600) * 1000 };
  assertEquals(
    fastestJumpToday(members, options),
    "⚡ Fastest jump from ⭐ to ⭐⭐ today: *Alice*, 5 min.",
  );
  // Real time is long after the day's window: not "today" anymore.
  assertEquals(
    fastestJumpToday(members, {
      day: 1,
      year: YEAR,
      now: (publish(1) + 2 * 86400) * 1000,
    }),
    undefined,
  );
  // Day 2 puzzle is out but nobody finished a jump since then: no message.
  assertEquals(
    fastestJumpToday(members, {
      day: 2,
      year: YEAR,
      now: (publish(2) + 60) * 1000,
    }),
    undefined,
  );
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
    "🔥 Longest streak: *Alice*, 2 days with both stars.",
  );
  assertEquals(streakLeaders([bob], 2), undefined);
  assertEquals(
    streakLeaders([alice, { ...alice, name: "Zed" }], 3),
    "🔥 Longest streak: *Alice* and *Zed*, 2 days with both stars.",
  );
});

Deno.test("hardest day is the one with the biggest silver-gold gap", () => {
  assertEquals(
    hardestDay(members, 2),
    "🧱 Toughest part 2 so far: day 2, 50% of participants solved part 1 but not part 2 (2 ⭐ → 1 ⭐⭐).",
  );
  assertEquals(hardestDay([], 2), undefined);
});

Deno.test("top three ranks by local score", () => {
  assertEquals(topThree(members), "🏆 Top 2: Anonymous 70, Alice 50");
  assertEquals(topThree([]), undefined);
  assertEquals(
    topThree([{ ...alice, local_score: 0 }, { ...bob, local_score: 0 }]),
    undefined,
  );
});

Deno.test("buildFunFacts skips facts without data", () => {
  assertEquals(buildFunFacts([], { day: 1, year: YEAR, now: 0 }), []);
});

Deno.test("nonParticipants", () => {
  const ghost: Member = {
    name: "Ghost",
    stars: 0,
    completion_day_level: [],
  };
  assertEquals(nonParticipants(members), undefined);
  assertEquals(
    nonParticipants([...members, ghost]),
    "👻 No stars yet this year: *Ghost*.",
  );
});

Deno.test("hardest day percentage is the difference of rounded chart values", () => {
  // 3 members: silver 2/3 -> 67, gold 1/3 -> 33. Raw gap 33.3 -> 33, chart gap 34.
  const mk = (name: string, s: boolean, g: boolean) => ({
    ...alice,
    name,
    completion_day_level: s
      ? [{
        day: 1,
        star_1_timestamp: 1,
        ...(g ? { star_2_timestamp: 2 } : {}),
      }]
      : [],
  });
  const trio = [
    mk("A", true, true),
    mk("B", true, false),
    mk("C", false, false),
  ];
  assertEquals(
    hardestDay(trio as typeof members, 1)?.includes("day 1, 34%"),
    true,
  );
});
