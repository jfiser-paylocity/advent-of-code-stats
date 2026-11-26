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
    total_participants: {
      type: Schema.types.number,
    },
    days_released: {
      type: Schema.types.number,
    },
    /** Puzzle day whose 24 hour window was open at fetch time, if any. */
    today: {
      type: Schema.types.number,
    },
    year: {
      type: Schema.types.number,
    },
    fun_facts: {
      type: Schema.types.array,
      items: {
        type: Schema.types.string,
      },
    },
  },
  required: [
    "progress",
    "daily_silver_stars",
    "daily_gold_stars",
    "days_released",
    "year",
  ],
});
