import { DefineFunction, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardMemberArrayType } from "../types/leaderboard.ts";
import { LeaderboardStatsCustomType } from "../types/leaderboard_stats.ts";

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
    },
    required: ["all_members"],
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
  ({ inputs: { all_members } }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    // Implement your function
    let completed_tasks_total = 0;
    let first_person_ts = (new Date()).getTime();
    let first_person_name;
    const daily_silver_stars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
    const daily_gold_stars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
    const total_participants = all_members.length;
    const day_today = Math.min(daily_gold_stars.length, (new Date()).getDate());

    // Use `let i` because i mutates (`i++`).
    for (const member of all_members) {
      completed_tasks_total += member.stars;
      for (const completion_level of member.completion_day_level) {
        if (completion_level.star_1_timestamp) {
          daily_silver_stars[completion_level.day - 1] += 1;
        }
        if (completion_level.star_2_timestamp) {
          daily_gold_stars[completion_level.day - 1] += 1;
          if (
            day_today != daily_gold_stars.length &&
            completion_level.day == day_today &&
            completion_level.star_2_timestamp < first_person_ts
          ) {
            first_person_ts = completion_level.star_2_timestamp;
            first_person_name = member.name;
          }
        }
      }
    }

    const available_tasks = 2 * day_today * total_participants;
    const total_progress_percentage =
      ((completed_tasks_total / available_tasks) * 100).toFixed(2);
    const total_progress_percentage_capped = Math.min(
      +total_progress_percentage,
      100,
    );

    const data = {
      "progress": total_progress_percentage_capped,
      "first_solution_today_by": first_person_name,
      "daily_silver_stars": daily_silver_stars.map((value) =>
        ((value / total_participants) * 100).toFixed()
      ),
      "daily_gold_stars": daily_gold_stars.map((value) =>
        ((value / total_participants) * 100).toFixed()
      ),
    };

    return { outputs: { stats: data } };
  },
);
