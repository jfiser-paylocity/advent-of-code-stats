import { DefineType, Schema } from "deno-slack-sdk/mod.ts";

export const LeaderboardStatsCustomType = DefineType({
  name: "LeaderboardStats",
  type: Schema.types.object,
  properties: {
    progress: {
      type: Schema.types.number,
    },
    first_solution_today_by: {
      type: Schema.types.string,
    },
    daily_silver_stars: {
      type: Schema.types.array,
      items: {
        type: Schema.types.number,
      },
    },
    daily_gold_stars: {
      type: Schema.types.array,
      items: {
        type: Schema.types.number,
      },
    },
  },
  required: ["progress", "daily_silver_stars", "daily_gold_stars"],
});
