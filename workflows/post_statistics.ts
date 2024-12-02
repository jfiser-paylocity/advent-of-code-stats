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
    required: ["leaderboard_1", "channel"],
  },
});

const stepLeaderboard = PostStatisticsWorkflow.addStep(
  FetchLeaderboardFunctionDefinition,
  {
    leaderboard_id: PostStatisticsWorkflow.inputs.leaderboard_1,
  },
);

const stepStatistics = PostStatisticsWorkflow.addStep(
  CreateLeaderboardStatsFunctionDefinition,
  {
    all_members: stepLeaderboard.outputs.members,
  },
);

const stepBarChart = PostStatisticsWorkflow.addStep(
  GenerateBarChartFunctionDefinition,
  {
    stats: stepStatistics.outputs.stats,
  },
);

PostStatisticsWorkflow.addStep(
  PostStatisticsFunctionDefinition,
  {
    channel: PostStatisticsWorkflow.inputs.channel,
    stats: stepStatistics.outputs.stats,
    bar_chart_url: stepBarChart.outputs.chart_url,
  },
);
