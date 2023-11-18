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
      leaderboards: { 
        type: Schema.types.array,
        items: { 
          type: Schema.types.string,
        },
        description: "String of leaderboard IDs separated by comma",
      },
    },
    required: ["leaderboards", "channel"],
  },
});

let leaderboards_data: String[] = [];
for (const leaderboard_id of PostStatisticsWorkflow.inputs.leaderboards.split(",")) {
  const step_result = PostStatisticsWorkflow.addStep(
    FetchLeaderboardFunctionDefinition,
    {
      leaderboard_id: leaderboard_id,
    },
  );
  leaderboards_data.push(step_result.outputs.leaderboard);
};

const statistics = PostStatisticsWorkflow.addStep(
  CreateLeaderboardStatsFunctionDefinition,
  {
    leaderboards: leaderboards_data,
  },
);

const bar_chart = PostStatisticsWorkflow.addStep(
  GenerateBarChartFunctionDefinition,
  {
    stats: statistics.outputs.stats,
  },
);

PostStatisticsWorkflow.addStep(
  PostStatisticsFunctionDefinition,
  {
    channel: PostStatisticsWorkflow.inputs.channel,
    stats: statistics.outputs.stats,
    bar_chart: bar_chart.outputs.chart,
  },
);