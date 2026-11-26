import { Trigger } from "deno-slack-api/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import { PostStatisticsWorkflow } from "../workflows/post_statistics.ts";
import { requireEnv } from "./require_env.ts";

/**
 * The schedule is pinned to one event on purpose. Every year a new Slack
 * channel is created for the event, so ADVENT_OF_CODE_STATS_CHANNEL_ID changes
 * and this trigger has to be redeployed anyway (scripts/deploy.sh). Update the
 * year in `start_time` and `end_time` at the same time as the channel ID.
 * Computing the dates from the current year would not help: the trigger would
 * still post into last year's channel.
 */
const DailyStarProgressTrigger: Trigger<
  typeof PostStatisticsWorkflow.definition
> = {
  type: TriggerTypes.Scheduled,
  name: "Daily star progress trigger",
  workflow: `#/workflows/${PostStatisticsWorkflow.definition.callback_id}`,
  inputs: {
    channel: {
      value: requireEnv("ADVENT_OF_CODE_STATS_CHANNEL_ID"),
    },
    leaderboard_1: {
      value: requireEnv("ADVENT_OF_CODE_STATS_LEADERBOARD_ID_1"),
    },
  },
  schedule: {
    // 21:00 UTC, 16 hours after the 05:00 UTC puzzle unlock.
    start_time: "2026-12-01T21:00:00Z",
    // Intentionally past the last puzzle (day 12 unlocks Dec 12). The company
    // event gives late solvers extra time to finish, so daily stats keep
    // coming until Dec 22 even though no new puzzles are published.
    end_time: "2026-12-22T23:59:59Z",
    frequency: {
      type: "hourly",
      repeats_every: 24,
    },
  },
};

export default DailyStarProgressTrigger;
