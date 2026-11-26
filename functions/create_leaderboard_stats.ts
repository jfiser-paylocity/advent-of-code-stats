import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardMemberArrayType } from "../types/leaderboard.ts";
import { LeaderboardStatsCustomType } from "../types/leaderboard_stats.ts";
import { buildFunFacts } from "./fun_facts.ts";
import { displayName, sharePercent } from "./members.ts";
import { EVENT_DAYS, eventClock } from "./aoc_time.ts";

export const CreateLeaderboardStatsFunctionDefinition = DefineFunction({
  callback_id: "create_leaderboard_stats",
  title: "Create leaderboard statistics",
  source_file: "functions/create_leaderboard_stats.ts",
  input_parameters: {
    properties: {
      all_members: {
        type: LeaderboardMemberArrayType,
        description: "Leaderboard data",
      },
      fetched_at: {
        type: Schema.types.number,
        description: "Time the leaderboard was fetched, in ms",
      },
    },
    required: ["all_members", "fetched_at"],
  },
  output_parameters: {
    properties: {
      stats: {
        type: LeaderboardStatsCustomType,
        description: "Leaderboard statistics",
      },
    },
    required: ["stats"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  CreateLeaderboardStatsFunctionDefinition,
  ({ inputs: { all_members, fetched_at } }) => {
    // Same clock as the fetch step, so both agree on year and day.
    const { year, released, today } = eventClock(fetched_at);
    let completed_tasks_total = 0;
    let first_person_ts = Infinity;
    let first_person_name;
    const daily_silver_stars: number[] = Array(EVENT_DAYS).fill(0);
    const daily_gold_stars: number[] = Array(EVENT_DAYS).fill(0);
    const total_participants = all_members.length;

    for (const member of all_members) {
      completed_tasks_total += member.stars;
      for (const completion_level of member.completion_day_level) {
        // Out of range days would write NaN and holes into the daily arrays.
        if (completion_level.day < 1 || completion_level.day > EVENT_DAYS) {
          console.warn(`Ignoring unexpected day ${completion_level.day}`);
          continue;
        }
        if (completion_level.star_1_timestamp) {
          daily_silver_stars[completion_level.day - 1] += 1;
        }
        if (completion_level.star_2_timestamp) {
          daily_gold_stars[completion_level.day - 1] += 1;
          if (
            completion_level.day === today &&
            completion_level.star_2_timestamp < first_person_ts
          ) {
            first_person_ts = completion_level.star_2_timestamp;
            first_person_name = displayName(member);
          }
        }
      }
    }

    const available_tasks = 2 * released * total_participants;
    // Empty leaderboard: report 0 % instead of NaN. Two decimals, capped.
    const total_progress_percentage_capped = available_tasks > 0
      ? Math.min(
        Math.round((completed_tasks_total / available_tasks) * 100 * 100) / 100,
        100,
      )
      : 0;

    const data = {
      "progress": total_progress_percentage_capped,
      "total_participants": total_participants,
      "days_released": released,
      "today": today,
      "year": year,
      "first_solution_today_by": first_person_name,
      "daily_silver_stars": daily_silver_stars.map((value) =>
        sharePercent(value, total_participants)
      ),
      "daily_gold_stars": daily_gold_stars.map((value) =>
        sharePercent(value, total_participants)
      ),
      "fun_facts": buildFunFacts(all_members, {
        day: released,
        year,
        now: fetched_at,
      }),
    };

    return { outputs: { stats: data } };
  },
);
