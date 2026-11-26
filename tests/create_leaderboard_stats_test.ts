import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import createLeaderboardStats, {
  CreateLeaderboardStatsFunctionDefinition,
} from "../functions/create_leaderboard_stats.ts";
import { EVENT_DAYS, publishTimestamp } from "../functions/aoc_time.ts";

function assertEquals<T>(actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected ${e} but got ${a}`);
  }
}

const { createContext } = SlackFunctionTester(
  CreateLeaderboardStatsFunctionDefinition,
);

const YEAR = 2025;
const publish = (day: number) => publishTimestamp(YEAR, day);
const solved = (day: number, part1: number, part2?: number) => ({
  day,
  star_1_timestamp: publish(day) + part1,
  ...(part2 != null ? { star_2_timestamp: publish(day) + part2 } : {}),
});

// Dec 3 2025 10:00 UTC: day 3 is the open day, 3 days released.
const DEC_3 = Date.UTC(YEAR, 11, 3, 10);

const alice = {
  id: 1,
  name: "Alice",
  stars: 6,
  local_score: 30,
  completion_day_level: [
    solved(1, 100, 200),
    solved(2, 100, 200),
    solved(3, 100, 500),
  ],
};
const bob = {
  id: 2,
  name: "Bob",
  stars: 4,
  local_score: 20,
  completion_day_level: [
    solved(1, 100, 200),
    solved(3, 100, 400),
    // Out of range, must be ignored instead of corrupting the arrays.
    { day: 99, star_1_timestamp: publish(1) },
    { day: 0, star_1_timestamp: publish(1) },
  ],
};
const anonymous = {
  id: 3,
  stars: 0,
  local_score: 0,
  completion_day_level: [],
};

async function run(
  all_members: unknown[],
  fetched_at: number,
) {
  type Inputs = Parameters<typeof createContext>[0]["inputs"];
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);
  try {
    const result = await createLeaderboardStats(
      createContext({ inputs: { all_members, fetched_at } as Inputs }),
    );
    // deno-lint-ignore no-explicit-any
    return { stats: (result as any).outputs.stats, warnings };
  } finally {
    console.warn = warn;
  }
}

const daily = (...values: number[]) => [
  ...values,
  ...Array(EVENT_DAYS - values.length).fill(0),
];

Deno.test("computes progress, daily percentages and today's first solver", async () => {
  const { stats, warnings } = await run([alice, bob, anonymous], DEC_3);
  assertEquals(stats.year, YEAR);
  assertEquals(stats.days_released, 3);
  assertEquals(stats.today, 3);
  assertEquals(stats.total_participants, 3);
  // 10 stars of 2 * 3 days * 3 participants = 55.56 %
  assertEquals(stats.progress, 55.56);
  assertEquals(stats.daily_silver_stars, daily(67, 33, 67));
  assertEquals(stats.daily_gold_stars, daily(67, 33, 67));
  // Bob finished day 3 part 2 earlier than Alice.
  assertEquals(stats.first_solution_today_by, "Bob");
  assertEquals(Array.isArray(stats.fun_facts), true);
  assertEquals(warnings, [
    "Ignoring unexpected day 99",
    "Ignoring unexpected day 0",
  ]);
});

Deno.test("anonymous first solver is reported as Anonymous", async () => {
  const anon = {
    ...anonymous,
    stars: 2,
    completion_day_level: [solved(3, 1, 2)],
  };
  const { stats } = await run([alice, anon], DEC_3);
  assertEquals(stats.first_solution_today_by, "Anonymous");
});

Deno.test("nobody solved today's part 2 yet", async () => {
  const partial = { ...alice, completion_day_level: [solved(3, 100)] };
  const { stats } = await run([partial], DEC_3);
  assertEquals(stats.first_solution_today_by, undefined);
  assertEquals(stats.daily_silver_stars, daily(0, 0, 100));
  assertEquals(stats.daily_gold_stars, daily());
});

Deno.test("empty leaderboard reports 0 instead of NaN", async () => {
  const { stats } = await run([], DEC_3);
  assertEquals(stats.progress, 0);
  assertEquals(stats.total_participants, 0);
  assertEquals(stats.daily_silver_stars, daily());
  assertEquals(stats.daily_gold_stars, daily());
});

Deno.test("progress is capped at 100 %", async () => {
  const inflated = { ...alice, stars: 50 };
  const { stats } = await run([inflated], DEC_3);
  assertEquals(stats.progress, 100);
});

Deno.test("outside December shows last year's final results without a today", async () => {
  const lastDay = { ...alice, completion_day_level: [solved(12, 1, 2)] };
  const { stats } = await run([lastDay], Date.UTC(YEAR + 1, 5, 1));
  assertEquals(stats.year, YEAR);
  assertEquals(stats.days_released, EVENT_DAYS);
  assertEquals(stats.today, undefined);
  assertEquals(stats.first_solution_today_by, undefined);
});
