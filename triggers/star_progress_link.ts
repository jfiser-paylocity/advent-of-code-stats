import { Trigger } from "deno-slack-api/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import { PostStatisticsWorkflow } from "../workflows/post_statistics.ts";
import { requireEnvList } from "./require_env.ts";

const StarProgressLinkTrigger: Trigger<
  typeof PostStatisticsWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "Star progress link trigger",
  workflow: `#/workflows/${PostStatisticsWorkflow.definition.callback_id}`,
  inputs: {
    channel: {
      value: TriggerContextData.Shortcut.channel_id,
    },
    leaderboard_ids: {
      // The CLI cannot send an array value, so IDs travel as "1,2,3".
      value: requireEnvList("ADVENT_OF_CODE_STATS_LEADERBOARD_IDS").join(","),
    },
  },
};

export default StarProgressLinkTrigger;
