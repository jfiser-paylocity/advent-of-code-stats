import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardStatsCustomType } from "../types/leaderboard_stats.ts";

export const PostStatisticsFunctionDefinition = DefineFunction({
  callback_id: "post_stats_message",
  title: "Post statistics",
  source_file: "functions/post_stats_message.ts",
  input_parameters: {
    properties: {
      channel: { 
        type: Schema.slack.types.channel_id,
      },
      stats: {
        type: LeaderboardStatsCustomType,
        description: "Leaderboard data",
      },
      bar_chart_url: {
        type: Schema.types.string,
        description: "Bar chart image URL",
      },
    },
    required: ["stats", "bar_chart"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  PostStatisticsFunctionDefinition,
  async ({ inputs, client }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    const blocks = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": [
            `Total star progress of the team for day ${(new Date()).getDate()} is *${inputs.stats.progress}%*.`,
            inputs.stats.first_solution_today_by ? `First participant to complete all tasks today was *${inputs.stats.first_solution_today_by}*, congrats!` : "You still have a chance to be the first to complete all tasks today!",
            "That is awesome, keep up at the good work! See below for the detailed chart."
          ].filter(x => x).join(" ")
        }
      },
      {
        "type": "image",
        "image_url": inputs.bar_chart_url,
        "alt_text": "daily star progress"
      }
    ];

    // 1. Post a message in thread to the draft announcement message
    const postResp = await client.chat.postMessage({
      channel: inputs.channel,
      thread_ts: "",
      blocks: blocks,
      unfurl_links: false,
    });
    if (!postResp.ok) {
      const summaryTS = postResp ? postResp.ts : "n/a";
      const postSummaryErrorMsg =
        `Error posting summary: ${summaryTS} to channel: ${inputs.channel}. Error detail: ${postResp.error}`;
      console.log(postSummaryErrorMsg);

      // 2. Complete function with an error message
      return { error: postSummaryErrorMsg };
    };
    return { outputs: {} };
  },
);