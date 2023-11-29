import { Trigger } from "deno-slack-api/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import { PostStatisticsWorkflow } from "../workflows/post_statistics.ts";
import "std/dotenv/load.ts";

const StarProgressLinkTrigger: Trigger<typeof PostStatisticsWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Sstar progress link trigger",
  workflow: `#/workflows/${PostStatisticsWorkflow.definition.callback_id}`,
  inputs: {
    channel: {
      value: TriggerContextData.Shortcut.channel_id,
    },
    leaderboard_1: {
      value: Deno.env.get("ADVENT_OF_CODE_STATS_LEADERBOARD_ID_1")!,
    },
  },
};

export default StarProgressLinkTrigger;