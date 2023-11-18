import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { KnownBlock } from "https://cdn.skypack.dev/@slack/types?dts";

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
        type: Schema.types.object,
        description: "Leaderboard data",
      },
      bar_chart: {
        type: Schema.types.object,
        description: "Bar chart image",
      },
    },
    required: ["stats", "bar_chart"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  PostStatisticsFunctionDefinition,
  async ({ inputs, client }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    // Implement your function
    const result = await client.files.upload({
      channels: inputs.channel,
      file: inputs.bar_chart.image,
    });
    if (!result.ok) {
      const errorMsg =
        `Error posting an image to channel: ${inputs.channel}. Error detail: ${result.error}`;
      console.log(errorMsg);

      // 2. Complete function with an error message
      return { error: errorMsg };
    };

    const bar_chart_url = result.file.permalink || result.file.url_private;
    const blocks: KnownBlock[] = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": [
            "Total star progress of the team has reached *40%*.",
            inputs.stats.first_solution_today_by ? `First participant to complete all tasks today was ${inputs.stats.first_solution_today_by}, congrats!` : null,
            "That is awesome, keep up at the good work!. See below for the detailed chart."
          ].filter(x => x).join(" ")
        }
      },
      {
        "type": "image",
        "image_url": bar_chart_url,
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
  },
);