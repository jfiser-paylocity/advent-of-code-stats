import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { sumOf } from "https://deno.land/std@0.206.0/collections/mod.ts";

export const CreateLeaderboardStatsFunctionDefinition = DefineFunction({
  callback_id: "create_leaderboard_stats",
  title: "Create leaderboard statistics",
  source_file: "functions/create_leaderboard_stats.ts",
  input_parameters: {
    properties: {
      leaderboards: {
        type: Schema.types.array,
        items: { type: Schema.types.object },
        description: "Leaderboard data",
      },
    },
    required: ["leaderboards"],
  },
  output_parameters: {
    properties: {
      stats: {
        type: Schema.types.object,
        description: "Leaderboard statistics",
      },
    },
    required: ["stats"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  CreateLeaderboardStatsFunctionDefinition,
  async ({ inputs }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    // Implement your function
    let completed_tasks_total = 0;
    let total_participants = 0;
    let first_person_ts = (new Date()).getTime();
    let first_person_name;
    let daily_silver_stars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let daily_gold_stars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const day_today = (new Date()).getDate();

    // Use `let i` because i mutates (`i++`).
    for (const leaderboard of inputs.leaderboards) {
      const members = Object.values(leaderboard.members);
      total_participants += members.length;
      completed_tasks_total += sumOf(members, (member) => member.stars);

      for (const member of members) {
        for (let [day, levels] of Object.entries(member.completion_day_level)) {
          if ("1" in levels) {
            daily_silver_stars[+day - 1] += 1;
          };
          if ("2" in levels) {
            daily_gold_stars[+day - 1] += 1;
            if (+day == day_today && +levels[2].get_star_ts < first_person_ts) {
              first_person_ts = +levels[2].get_star_ts;
              first_person_name = member.name;
            };
          };
        };
      };
    };

    const available_tasks = 2 * day_today * total_participants;
    const total_progress_percentage = ((completed_tasks_total / available_tasks) * 100).toFixed(2);

    const data = {
      "progress": total_progress_percentage,
      "first_solution_today_by": first_person_name,
      "daily_silver_stars": daily_silver_stars,
      "daily_gold_stars": daily_gold_stars,
    };

    return { outputs: { data } };
  },
);