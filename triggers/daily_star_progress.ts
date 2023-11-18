import { Trigger } from "deno-slack-api/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import { PostStatisticsWorkflow } from "../workflows/post_statistics.ts";
import "std/dotenv/load.ts";

const DailyStarProgressTrigger: Trigger<typeof PostStatisticsWorkflow.definition> = {
  type: TriggerTypes.Scheduled,
  name: "Daily star progress trigger",
  workflow: `#/workflows/${PostStatisticsWorkflow.definition.callback_id}`,
  inputs: {
    channel: {
      value: TriggerContextData.Shortcut.channel_id,
    },
    leaderboards: {
      value: Deno.env.get("ADVENT_OF_CODE_STATS_LEADERBOARD_IDS")!,
    },
  },
  schedule: {
    start_time: "2023-12-01T07:00:00.000Z",
    end_time: "2023-12-31T23:59:59.999Z",
    frequency: { type: "hourly", repeats_every: 12 },
  },
};

export default DailyStarProgressTrigger;