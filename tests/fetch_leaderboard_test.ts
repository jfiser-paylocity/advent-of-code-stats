import { mapLeaderboard } from "../functions/fetch_leaderboard.ts";

function assertEquals<T>(actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected ${e} but got ${a}`);
  }
}

Deno.test("mapLeaderboard maps AoC JSON to the member type", () => {
  const members = mapLeaderboard({
    members: {
      "1": {
        id: 1,
        name: "Alice",
        stars: 3,
        local_score: 10,
        completion_day_level: {
          "1": { "1": { get_star_ts: 100 }, "2": { get_star_ts: 200 } },
          "2": { "1": { get_star_ts: 300 } },
        },
      },
      "2": {
        id: 2,
        name: null,
        stars: 0,
        local_score: 0,
        completion_day_level: {},
      },
    },
  });
  assertEquals(members, [
    {
      id: 1,
      completion_day_level: [
        { day: 1, star_1_timestamp: 100, star_2_timestamp: 200 },
        { day: 2, star_1_timestamp: 300, star_2_timestamp: undefined },
      ],
      stars: 3,
      local_score: 10,
      name: "Alice",
    },
    { id: 2, completion_day_level: [], stars: 0, local_score: 0 },
  ]);
  // Anonymous members have no name key at all.
  assertEquals("name" in members[1], false);
});
