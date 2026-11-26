import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardStatsCustomType } from "../types/leaderboard_stats.ts";
import { LeaderboardMemberArrayType } from "../types/leaderboard.ts";
import { renderPixelTree } from "./pixel_tree.ts";

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
      members: {
        type: LeaderboardMemberArrayType,
        description: "Leaderboard members, used for the pixel tree",
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

    const blocks: Record<string, unknown>[] = [
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
      // 1. Upload the pixel tree (not shared anywhere yet) so it can be
      // embedded in the main message. A failure here must not block the post.
      let treeBlock: Record<string, unknown> | undefined;
      if (inputs.members?.length) {
        try {
          const day = Math.min(
            12,
            inputs.stats.days_released ?? day_today_capped,
          );
          const tree = await uploadPixelTree(
            client,
            inputs.members,
            inputs.stats.year ?? new Date().getFullYear(),
            day,
          );
          if (tree.fileId) {
            treeBlock = {
              "type": "image",
              "slack_file": { "id": tree.fileId },
              "alt_text":
                "pixel advent tree: one ornament per star, one snowflake per participant",
            };
          } else {
            console.warn(tree.error);
          }
        } catch (err) {
          error = `Failed to create pixel tree due to ${err}`;
        }
      }

      // 2. Post the statistics message to the channel. A freshly uploaded file
      // may not be usable in a block immediately, so retry a couple of times.
      const post = (withTree: boolean) =>
        client.chat.postMessage({
          channel: inputs.channel,
          thread_ts: "",
          blocks: withTree && treeBlock ? [...blocks, treeBlock] : blocks,
          unfurl_links: false,
        });
      let postResp = await post(!!treeBlock);
      for (let retry = 0; !postResp.ok && treeBlock && retry < 2; retry++) {
        // Slack puts the exact block problem in response_metadata.messages.
        console.warn(
          `Pixel tree embed failed (${postResp.error}): ${
            JSON.stringify(postResp.response_metadata?.messages)
          }`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        postResp = await post(true);
      }
      if (!postResp.ok && treeBlock) {
        // Still failing: post without the tree. Not fatal for the workflow.
        console.warn(
          `Posting without pixel tree (${postResp.error}): ${
            JSON.stringify(postResp.response_metadata?.messages)
          }`,
        );
        postResp = await post(false);
      }

      if (!postResp.ok) {
        const summaryTS = postResp ? postResp.ts : "n/a";
        error =
          `Error posting summary: ${summaryTS} to channel: ${inputs.channel}. Error detail: ${postResp.error}`;
      } else if (inputs.stats.fun_facts?.length) {
        // 3. Post fun facts in the thread of the statistics message.
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

// deno-lint-ignore no-explicit-any
type SlackClient = any;

/**
 * Render the pixel tree and upload it to Slack without sharing it to a
 * channel. The returned file id is embedded in the main message as an image
 * block (`slack_file`), because files cannot be attached to a posted message.
 */
async function uploadPixelTree(
  client: SlackClient,
  members: Parameters<typeof renderPixelTree>[0],
  year: number,
  day: number,
): Promise<{ fileId?: string; error?: string }> {
  const { png } = await renderPixelTree(members, { year, upto: day });

  // Slack's external upload flow: get URL, send bytes, complete.
  const start = await client.files.getUploadURLExternal({
    filename: `advent_tree_${year}_day${day}.png`,
    length: png.length,
  });
  if (!start.ok) {
    return { error: `Error preparing tree upload: ${start.error}` };
  }
  const upload = await fetch(start.upload_url, {
    method: "POST",
    body: png.buffer as ArrayBuffer,
  });
  if (!upload.ok) {
    return { error: `Error uploading tree image: ${upload.status}` };
  }
  const done = await client.files.completeUploadExternal({
    files: [{ id: start.file_id, title: `Advent tree, day ${day}` }],
  });
  if (!done.ok) return { error: `Error finishing tree upload: ${done.error}` };
  return { fileId: start.file_id };
}
