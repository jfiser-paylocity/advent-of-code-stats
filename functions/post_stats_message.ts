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
    required: ["channel", "stats", "bar_chart_url"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  PostStatisticsFunctionDefinition,
  async ({ inputs, client }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    const day_today = (new Date()).getDate();
    const day_today_capped = Math.min(12, day_today);
    const text = [
      "Total star progress of the team",
      `is *${inputs.stats.progress}%*.`,
    ];
    if (day_today == day_today_capped) {
      text.splice(1, 0, `for day ${day_today_capped}`);
      if (inputs.stats.first_solution_today_by) {
        text.push(
          `First participant to complete all tasks today was *${inputs.stats.first_solution_today_by}*, congrats!`,
        );
      } else {
        text.push(
          "You still have a chance to be the first to complete all tasks today!",
        );
      }
      text.push("Share your execution times in the thread.");
    }

    const blocks = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": text.join(" "),
        },
      },
      {
        "type": "image",
        "image_url": inputs.bar_chart_url,
        "alt_text": "daily star progress",
      },
    ];

    let error;
    try {
      // 1. Post the statistics message to the channel
      const postResp = await client.chat.postMessage({
        channel: inputs.channel,
        thread_ts: "",
        blocks: blocks,
        unfurl_links: false,
      });

      if (!postResp.ok) {
        const summaryTS = postResp ? postResp.ts : "n/a";
        error =
          `Error posting summary: ${summaryTS} to channel: ${inputs.channel}. Error detail: ${postResp.error}`;
      } else if (inputs.stats.fun_facts?.length) {
        // 2. Post fun facts in the thread of the statistics message.
        // A failure here must not hide the already posted main message.
        try {
          const threadResp = await client.chat.postMessage({
            channel: inputs.channel,
            thread_ts: postResp.ts,
            text: inputs.stats.fun_facts.join("\n"),
            unfurl_links: false,
          });
          if (!threadResp.ok) {
            error =
              `Error posting fun facts to thread ${postResp.ts}. Error detail: ${threadResp.error}`;
          }
        } catch (err) {
          error = `Failed to post fun facts to thread due to ${err}`;
        }
      }
    } catch (err) {
      error = `Failed to call AoC API due to ${err}`;
    }

    return { error, outputs: {} };
  },
);
