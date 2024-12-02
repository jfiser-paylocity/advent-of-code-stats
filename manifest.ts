import { Manifest } from "deno-slack-sdk/mod.ts";
import { PostStatisticsWorkflow } from "./workflows/post_statistics.ts";
import { FetchLeaderboardFunctionDefinition } from "./functions/fetch_leaderboard.ts";
import { CreateLeaderboardStatsFunctionDefinition } from "./functions/create_leaderboard_stats.ts";
import { GenerateBarChartFunctionDefinition } from "./functions/generate_bar_chart.ts";
import { PostStatisticsFunctionDefinition } from "./functions/post_stats_message.ts";
import {
  LeaderboardMemberArrayType,
  LeaderboardMemberCustomType,
} from "./types/leaderboard.ts";
import { LeaderboardStatsCustomType } from "./types/leaderboard_stats.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/future/manifest
 */
export default Manifest({
  name: "Advent of Code",
  description: "Advent of code daily statistics",
  icon: "assets/app_icon.png",
  functions: [
    FetchLeaderboardFunctionDefinition,
    CreateLeaderboardStatsFunctionDefinition,
    GenerateBarChartFunctionDefinition,
    PostStatisticsFunctionDefinition,
  ],
  workflows: [PostStatisticsWorkflow],
  types: [
    LeaderboardMemberCustomType,
    LeaderboardMemberArrayType,
    LeaderboardStatsCustomType,
  ],
  outgoingDomains: ["adventofcode.com", "quickchart.io"],
  botScopes: ["chat:write"],
});
