import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import fetchLeaderboard, {
  FetchLeaderboardFunctionDefinition,
  mapLeaderboard,
} from "../functions/fetch_leaderboard.ts";
import { eventClock } from "../functions/aoc_time.ts";

function assertEquals<T>(actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected ${e} but got ${a}`);
  }
}

function assertIncludes(actual: string | undefined, expected: string) {
  if (!actual?.includes(expected)) {
    throw new Error(`Expected "${actual}" to include "${expected}"`);
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

const { createContext } = SlackFunctionTester(
  FetchLeaderboardFunctionDefinition,
);

type FetchCall = { url: string; init?: RequestInit };

/** Run the handler with `fetch` replaced by `respond`. */
async function runFetch(
  respond: (call: FetchCall) => Response | Promise<Response>,
  env: Record<string, string> = { ADVENT_OF_CODE_STATS_SESSION_COOKIE: "abc" },
  leaderboard_ids = "123",
) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  try {
    const result = await fetchLeaderboard(
      createContext({ inputs: { leaderboard_ids }, env }),
    );
    // deno-lint-ignore no-explicit-any
    return { result: result as any, calls };
  } finally {
    globalThis.fetch = original;
  }
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

Deno.test("handler fails without the session cookie", async () => {
  const { result, calls } = await runFetch(() => json({}), {});
  assertEquals(calls.length, 0);
  assertIncludes(result.error, "ADVENT_OF_CODE_STATS_SESSION_COOKIE");
});

Deno.test("handler fetches the current event's leaderboard", async () => {
  const before = Date.now();
  const { result, calls } = await runFetch(() =>
    json({
      members: {
        "7": {
          id: 7,
          name: "Zed",
          stars: 1,
          local_score: 5,
          completion_day_level: { "1": { "1": { get_star_ts: 42 } } },
        },
      },
    })
  );
  const { year } = eventClock(before);
  assertEquals(
    calls[0].url,
    `https://adventofcode.com/${year}/leaderboard/private/view/123.json`,
  );
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers.Cookie, "session=abc");
  assertEquals(calls[0].init?.redirect, "manual");
  assertEquals(result.error, undefined);
  assertEquals(result.outputs.members, [
    {
      id: 7,
      completion_day_level: [{ day: 1, star_1_timestamp: 42 }],
      stars: 1,
      local_score: 5,
      name: "Zed",
    },
  ]);
  assertEquals(
    result.outputs.fetched_at >= before &&
      result.outputs.fetched_at <= Date.now(),
    true,
  );
});

Deno.test("handler reports a redirect as an expired cookie", async () => {
  const { result } = await runFetch(() =>
    new Response("moved", {
      status: 302,
      headers: { location: "/2025/auth/login" },
    })
  );
  assertIncludes(result.error, "Leaderboard 123:");
  assertIncludes(result.error, "redirected (status: 302");
  assertIncludes(result.error, "location: /2025/auth/login");
  assertIncludes(result.error, "probably expired");
});

for (const status of [400, 401, 403]) {
  Deno.test(`handler hints at cookie or ID on status ${status}`, async () => {
    const { result } = await runFetch(() => new Response("nope", { status }));
    assertIncludes(result.error, `status: ${status}`);
    assertIncludes(result.error, "or the leaderboard ID is wrong");
    assertIncludes(result.error, "body: nope");
  });
}

Deno.test("handler truncates long error bodies without a hint on 500", async () => {
  const { result } = await runFetch(() =>
    new Response("x".repeat(500), { status: 500 })
  );
  assertIncludes(result.error, "status: 500, body: ");
  assertEquals(result.error.includes("leaderboard ID"), false);
  assertIncludes(result.error, `${"x".repeat(200)}…)`);
  assertEquals(result.error.includes("x".repeat(201)), false);
});

Deno.test("handler rejects a non JSON 200 response", async () => {
  const { result } = await runFetch(() =>
    new Response("<html>login</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
  assertIncludes(result.error, "returned text/html instead of JSON");
  assertIncludes(result.error, "<html>login</html>");
});

Deno.test("handler reports network errors", async () => {
  const { result } = await runFetch(() => {
    throw new TypeError("connection refused");
  });
  assertIncludes(result.error, "Failed to call AoC API due to");
  assertIncludes(result.error, "connection refused");
});

const member = (
  id: number,
  ts: number,
  local_score: number,
) => ({
  id,
  name: `m${id}`,
  stars: 1,
  local_score,
  completion_day_level: { "1": { "1": { get_star_ts: ts } } },
});

Deno.test("handler merges several leaderboards and recomputes local score", async () => {
  const boards: Record<string, unknown> = {
    "1": { members: { "1": member(1, 100, 2), "2": member(2, 200, 1) } },
    "2": { members: { "2": member(2, 200, 2), "3": member(3, 50, 1) } },
  };
  const { result, calls } = await runFetch(
    ({ url }) => json(boards[url.match(/view\/(\d+)\.json/)![1]]),
    { ADVENT_OF_CODE_STATS_SESSION_COOKIE: "abc" },
    "1, 2",
  );
  assertEquals(calls.length, 2);
  // Member 2 is on both boards and kept once. N = 3: ts 50 -> 3, 100 -> 2, 200 -> 1.
  assertEquals(
    // deno-lint-ignore no-explicit-any
    result.outputs.members.map((m: any) => [m.id, m.local_score, m.stars]),
    [[1, 2, 1], [2, 1, 1], [3, 3, 1]],
  );
});

Deno.test("handler keeps the API local score for a single leaderboard", async () => {
  const { result } = await runFetch(() =>
    json({ members: { "1": member(1, 100, 99) } })
  );
  assertEquals(result.outputs.members[0].local_score, 99);
});

Deno.test("handler names the failing leaderboard", async () => {
  const { result } = await runFetch(
    ({ url }) =>
      url.includes("/2.json")
        ? new Response("nope", { status: 403 })
        : json({ members: {} }),
    { ADVENT_OF_CODE_STATS_SESSION_COOKIE: "abc" },
    "1, 2",
  );
  assertIncludes(result.error, "Leaderboard 2:");
  assertIncludes(result.error, "status: 403");
});
