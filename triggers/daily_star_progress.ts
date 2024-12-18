import { Trigger } from "deno-slack-api/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import { PostStatisticsWorkflow } from "../workflows/post_statistics.ts";
import "std/dotenv/load.ts";

const DailyStarProgressTrigger: Trigger<
  typeof PostStatisticsWorkflow.definition
> = {
  type: TriggerTypes.Scheduled,
  name: "Daily star progress trigger",
  workflow: `#/workflows/${PostStatisticsWorkflow.definition.callback_id}`,
  inputs: {
    channel: {
      value: Deno.env.get("ADVENT_OF_CODE_STATS_CHANNEL_ID")!,
    },
    leaderboard_1: {
      value: Deno.env.get("ADVENT_OF_CODE_STATS_LEADERBOARD_ID_1")!,
    },
  },
  schedule: {
    start_time: "2024-12-02T21:00:00Z",
    end_time: "2024-12-30T23:59:59Z",
    frequency: {
      type: "hourly",
      repeats_every: 24,
    },
  },
};

export default DailyStarProgressTrigger;
