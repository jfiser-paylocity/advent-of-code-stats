import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardMemberArrayType } from "../types/leaderboard.ts";
import { eventClock } from "./aoc_time.ts";

const FETCH_TIMEOUT_MS = 10_000;
/** Keep error messages readable when AoC answers with a whole HTML page. */
const MAX_ERROR_BODY_LENGTH = 200;
const EXPIRED_COOKIE_HINT =
  "the session cookie (ADVENT_OF_CODE_STATS_SESSION_COOKIE) is probably expired or invalid";

/** Shape of the private leaderboard JSON returned by adventofcode.com. */
type AocStar = { get_star_ts: number; star_index?: number };
type AocMember = {
  id: number;
  name: string | null;
  stars: number;
  local_score: number;
  completion_day_level: Record<string, { "1"?: AocStar; "2"?: AocStar }>;
};
type AocLeaderboard = { members: Record<string, AocMember> };

export const FetchLeaderboardFunctionDefinition = DefineFunction({
  callback_id: "fetch_leaderboard",
  title: "Fetch leaderboard",
  source_file: "functions/fetch_leaderboard.ts",
  input_parameters: {
    properties: {
      leaderboard_ids: {
        type: Schema.types.string,
        description:
          "Comma-separated leaderboard IDs, members are merged by user ID",
      },
    },
    required: ["leaderboard_ids"],
  },
  output_parameters: {
    properties: {
      members: {
        type: LeaderboardMemberArrayType,
        description: "Leaderboard members",
      },
      fetched_at: {
        type: Schema.types.number,
        description:
          "Fetch time in ms, the single clock later steps use to work out the event day",
      },
    },
    required: ["members", "fetched_at"],
  },
});

/** Map the AoC JSON to the LeaderboardMember custom type. */
export function mapLeaderboard(data: AocLeaderboard) {
  return Object.values(data.members).map(
    ({ id, completion_day_level, name, stars, local_score }) => ({
      id,
      completion_day_level: Object.entries(completion_day_level).map(
        ([day, levels]) => ({
          day: +day,
          star_1_timestamp: levels["1"]?.get_star_ts,
          star_2_timestamp: levels["2"]?.get_star_ts,
        }),
      ),
      stars,
      local_score,
      // Anonymous members have `name: null`, the custom type wants it absent.
      ...(name != null ? { name } : {}),
    }),
  );
}

const truncate = (text: string) =>
  text.length > MAX_ERROR_BODY_LENGTH
    ? `${text.slice(0, MAX_ERROR_BODY_LENGTH)}…`
    : text;

type MappedMember = ReturnType<typeof mapLeaderboard>[number];

/**
 * Merge members of several leaderboards. A user has the same stars and
 * timestamps on every board, so the first occurrence is kept as is.
 */
export function mergeMembers(boards: MappedMember[][]): MappedMember[] {
  const byId = new Map<number, MappedMember>();
  for (const member of boards.flat()) {
    if (!byId.has(member.id)) byId.set(member.id, member);
  }
  return [...byId.values()];
}

/**
 * AoC local score depends on the size of one board, so it is not comparable
 * between boards. Recompute it for the merged set: for each star the first
 * member gets N points (N = member count), the next N - 1, and so on.
 */
export function recomputeLocalScores(members: MappedMember[]): MappedMember[] {
  const n = members.length;
  const scores = new Map<number, number>(members.map((m) => [m.id, 0]));
  const stars = new Map<string, { id: number; ts: number }[]>();
  for (const { id, completion_day_level } of members) {
    for (
      const { day, star_1_timestamp, star_2_timestamp } of completion_day_level
    ) {
      for (
        const [part, ts] of [[1, star_1_timestamp], [
          2,
          star_2_timestamp,
        ]] as const
      ) {
        if (ts === undefined) continue;
        const key = `${day}-${part}`;
        stars.set(key, [...(stars.get(key) ?? []), { id, ts }]);
      }
    }
  }
  for (const entries of stars.values()) {
    // Ties keep a stable order by member ID.
    entries.sort((a, b) => a.ts - b.ts || a.id - b.id);
    entries.forEach(({ id }, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + n - rank);
    });
  }
  return members.map((m) => ({ ...m, local_score: scores.get(m.id) ?? 0 }));
}

/** Fetch one leaderboard. Errors name the leaderboard ID. */
async function fetchOne(
  id: string,
  year: number,
  cookie: string,
): Promise<{ members: MappedMember[] } | { error: string }> {
  const endpoint =
    `https://adventofcode.com/${year}/leaderboard/private/view/${id}.json`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Cookie: `session=${cookie}`,
        "User-Agent": "github.com/jfiser-paylocity/advent-of-code-stats",
      },
      // AoC redirects to a HTML page when the session is not valid. Do not
      // follow it, so the failure is reported as such and not as bad JSON.
      redirect: "manual",
      // Do not hang the workflow if AoC is slow or unreachable.
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return {
        error: `AoC API redirected (status: ${response.status}, location: ${
          response.headers.get("location")
        }), ${EXPIRED_COOKIE_HINT}`,
      };
    }
    if (response.status !== 200) {
      const body = truncate(await response.text());
      const hint = response.status === 400 || response.status === 401 ||
          response.status === 403
        ? `, ${EXPIRED_COOKIE_HINT} or the leaderboard ID is wrong`
        : "";
      return {
        error:
          `Failed to call AoC API (status: ${response.status}${hint}, body: ${body})`,
      };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      const body = truncate(await response.text());
      return {
        error:
          `AoC API returned ${contentType} instead of JSON, ${EXPIRED_COOKIE_HINT} (body: ${body})`,
      };
    }
    const data: AocLeaderboard = await response.json();
    return { members: mapLeaderboard(data) };
  } catch (err) {
    return { error: `Failed to call AoC API due to ${err}` };
  }
}

export default SlackFunction(
  FetchLeaderboardFunctionDefinition,
  async ({ inputs, env }) => {
    const cookie = env.ADVENT_OF_CODE_STATS_SESSION_COOKIE;
    if (!cookie) {
      return {
        error:
          "Missing env var ADVENT_OF_CODE_STATS_SESSION_COOKIE (set it with `slack env add`)",
      };
    }
    const ids = [
      ...new Set(
        inputs.leaderboard_ids.split(",").map((id) => id.trim()).filter(
          Boolean,
        ),
      ),
    ];
    if (ids.length === 0) return { error: "No leaderboard IDs given" };
    const fetched_at = Date.now();
    // Outside December this is last year's event (its final results).
    const { year } = eventClock(fetched_at);
    const results = await Promise.all(
      ids.map(async (id) => ({ id, result: await fetchOne(id, year, cookie) })),
    );
    for (const { id, result } of results) {
      if ("error" in result) {
        return { error: `Leaderboard ${id}: ${result.error}` };
      }
    }
    const boards = results.map(({ result }) =>
      (result as { members: MappedMember[] }).members
    );
    // One board: keep AoC's own local score and stars untouched.
    const members = boards.length === 1
      ? boards[0]
      : recomputeLocalScores(mergeMembers(boards));
    return { outputs: { members, fetched_at } };
  },
);
