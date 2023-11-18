import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { FetchLeaderboardFunctionDefinition } from "../functions/fetch_leaderboard.ts";
import { CreateLeaderboardStatsFunctionDefinition } from "../functions/create_leaderboard_stats.ts";
import { GenerateBarChartFunctionDefinition } from "../functions/generate_bar_chart.ts";
import { PostStatisticsFunctionDefinition } from "../functions/post_stats_message.ts";

export const PostStatisticsWorkflow = DefineWorkflow({
  callback_id: "post_statistics",
  title: "Post statistics",
  input_parameters: {
    properties: {
      channel: { 
        type: Schema.slack.types.channel_id,
      },
      leaderboard_1: { 
        type: Schema.types.string,
        description: "First leaderboard ID",
      },
    },
    required: ["leaderboards", "channel"],
  },
});

const step_leaderboard_1 = PostStatisticsWorkflow.addStep(
  FetchLeaderboardFunctionDefinition,
  {
    leaderboard_id: PostStatisticsWorkflow.inputs.leaderboard_1,
  },
);

const step_statistics = PostStatisticsWorkflow.addStep(
  CreateLeaderboardStatsFunctionDefinition,
  {
    all_leaderboard_members: [step_leaderboard_1.outputs.members].flatMap((members) => members),
  },
);

const step_bar_chart = PostStatisticsWorkflow.addStep(
  GenerateBarChartFunctionDefinition,
  {
    stats: step_statistics.outputs.stats,
  },
);

PostStatisticsWorkflow.addStep(
  PostStatisticsFunctionDefinition,
  {
    channel: PostStatisticsWorkflow.inputs.channel,
    stats: step_statistics.outputs.stats,
    bar_chart: step_bar_chart.outputs.chart,
  },
);