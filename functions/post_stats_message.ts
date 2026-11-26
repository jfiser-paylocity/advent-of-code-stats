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
    const { today, days_released, year } = inputs.stats;
    const text = [
      "Total star progress of the team",
      `is *${inputs.stats.progress}%*.`,
    ];
    if (today) {
      text.splice(1, 0, `for day ${today}`);
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
          const tree = await uploadPixelTree(
            client,
            inputs.members,
            year,
            days_released,
          );
          if (tree.fileId) {
            const complete = !tree.hiddenStars && !tree.droppedFlakes;
            if (!complete) {
              console.warn(
                `Pixel tree is full: ${tree.hiddenStars} stars and ${tree.droppedFlakes} participants not drawn`,
              );
            }
            treeBlock = {
              "type": "image",
              "slack_file": { "id": tree.fileId },
              "alt_text": complete
                ? "pixel advent tree: one ornament per star, one snowflake per participant"
                : "pixel advent tree: ornaments for stars, snowflakes for participants (too many to show all)",
            };
          } else {
            console.warn(tree.error);
          }
        } catch (err) {
          // Not fatal: the statistics are posted without the tree.
          console.warn(`Failed to create pixel tree due to ${err}`);
        }
      }

      // 2. Post the statistics message to the channel. A freshly uploaded file
      // may not be usable in a block immediately, so retry a couple of times.
      // Errors that have nothing to do with the tree are not retried.
      const post = (withTree: boolean) =>
        client.chat.postMessage({
          channel: inputs.channel,
          blocks: withTree && treeBlock ? [...blocks, treeBlock] : blocks,
          unfurl_links: false,
        });
      const treeMayHelp = (resp: { ok: boolean; error?: string }) =>
        !resp.ok && !!treeBlock && !NON_RETRYABLE_ERRORS.has(resp.error ?? "");
      // Slack puts the exact block problem in response_metadata.messages.
      const detail = (resp: typeof postResp) =>
        `${resp.error}: ${JSON.stringify(resp.response_metadata?.messages)}`;
      let postResp = await post(!!treeBlock);
      let retries = 0;
      while (treeMayHelp(postResp) && retries < TREE_RETRIES) {
        retries++;
        // Expected right after upload, so this is not a warning yet.
        console.log(
          `Pixel tree not ready (${
            detail(postResp)
          }), retry ${retries}/${TREE_RETRIES} in ${TREE_RETRY_DELAY_MS} ms`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, TREE_RETRY_DELAY_MS)
        );
        postResp = await post(true);
      }
      if (treeMayHelp(postResp)) {
        // Still failing: post without the tree. Not fatal for the workflow.
        console.warn(
          `Pixel tree still not accepted after ${retries} retries (${
            detail(postResp)
          }), posting without it`,
        );
        postResp = await post(false);
      } else if (postResp.ok && treeBlock) {
        console.log(
          retries
            ? `Pixel tree embedded after ${retries} ${
              retries === 1 ? "retry" : "retries"
            }`
            : "Pixel tree embedded",
        );
      }

      if (!postResp.ok) {
        error =
          `Error posting summary to channel: ${inputs.channel}. Error detail: ${postResp.error}`;
      } else if (inputs.stats.fun_facts?.length) {
        // 3. Post fun facts in the thread of the statistics message.
        // The main message is already posted, so a failure here is only
        // logged and does not fail the workflow.
        try {
          const threadResp = await client.chat.postMessage({
            channel: inputs.channel,
            thread_ts: postResp.ts,
            text: inputs.stats.fun_facts.join("\n"),
            unfurl_links: false,
          });
          if (!threadResp.ok) {
            console.warn(
              `Error posting fun facts to thread ${postResp.ts}. Error detail: ${threadResp.error}`,
            );
          }
        } catch (err) {
          console.warn(`Failed to post fun facts to thread due to ${err}`);
        }
      }
    } catch (err) {
      error = `Failed to post statistics due to ${err}`;
    }

    return { error, outputs: {} };
  },
);

/**
 * chat.postMessage errors that a retry or dropping the tree image cannot fix
 * (channel access, auth, rate limits). Anything else may be the tree block.
 */
const NON_RETRYABLE_ERRORS = new Set([
  "channel_not_found",
  "not_in_channel",
  "is_archived",
  "restricted_action",
  "invalid_auth",
  "not_authed",
  "token_revoked",
  "account_inactive",
  "missing_scope",
  "ratelimited",
]);

const UPLOAD_TIMEOUT_MS = 15_000;

/** A freshly uploaded file is often rejected for a moment ("invalid slack file"). */
const TREE_RETRIES = 2;
const TREE_RETRY_DELAY_MS = 2000;

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
): Promise<
  {
    fileId?: string;
    error?: string;
    hiddenStars?: number;
    droppedFlakes?: number;
  }
> {
  const { png, hiddenStars, droppedFlakes } = await renderPixelTree(members, {
    year,
    upto: day,
  });

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
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!upload.ok) {
    return { error: `Error uploading tree image: ${upload.status}` };
  }
  const done = await client.files.completeUploadExternal({
    files: [{ id: start.file_id, title: `Advent tree, day ${day}` }],
  });
  if (!done.ok) return { error: `Error finishing tree upload: ${done.error}` };
  return { fileId: start.file_id, hiddenStars, droppedFlakes };
}
