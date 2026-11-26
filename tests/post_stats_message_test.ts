import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import postStatsMessage, {
  PostStatisticsFunctionDefinition,
} from "../functions/post_stats_message.ts";
import { publishTimestamp } from "../functions/aoc_time.ts";

function assertEquals<T>(actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected ${e} but got ${a}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const { createContext } = SlackFunctionTester(
  PostStatisticsFunctionDefinition,
);

const YEAR = 2025;
const member = (id: number) => ({
  id,
  stars: 2,
  completion_day_level: [{
    day: 1,
    star_1_timestamp: publishTimestamp(YEAR, 1) + 600,
    star_2_timestamp: publishTimestamp(YEAR, 1) + 900,
  }],
});

const stats = {
  progress: 55.56,
  total_participants: 2,
  days_released: 3,
  today: 3,
  year: YEAR,
  first_solution_today_by: "Bob",
  daily_silver_stars: [],
  daily_gold_stars: [],
  fun_facts: ["fact 1", "fact 2"],
};

type Resp = { ok: boolean; error?: string; [key: string]: unknown };
// deno-lint-ignore no-explicit-any
type Message = Record<string, any>;

type MockOptions = {
  /** Responses for successive chat.postMessage calls to the channel root. */
  posts?: (Resp | Error)[];
  thread?: Resp | Error;
  uploadStart?: Resp | Error;
  uploadStatus?: number;
  uploadComplete?: Resp;
};

/**
 * Run the handler against a fake Slack Web API and file upload endpoint (the
 * SDK always builds its own client, so `fetch` is replaced) and an immediate
 * `setTimeout` so the retry delay does not slow the tests.
 */
async function run(
  inputs: Record<string, unknown>,
  options: MockOptions = {},
) {
  const posts: Message[] = [];
  const threads: Message[] = [];
  const uploads: Message[] = [];
  const logs: string[] = [];
  const postQueue = [...(options.posts ?? [])];
  const answer = (resp: Resp | Error | undefined, fallback: Resp) => {
    const value = resp ?? fallback;
    return value instanceof Error
      ? Promise.reject(value)
      : Promise.resolve(value);
  };

  const api: Record<string, (args: Message) => Promise<Resp>> = {
    "chat.postMessage": (message: Message) => {
      if (message.thread_ts) {
        threads.push(message);
        return answer(options.thread, { ok: true });
      }
      posts.push(message);
      return answer(postQueue.shift(), { ok: true, ts: "111.222" });
    },
    "files.getUploadURLExternal": (args: Message) => {
      uploads.push(args);
      return answer(options.uploadStart, {
        ok: true,
        upload_url: "https://files.slack.test/upload",
        file_id: "F123",
      });
    },
    "files.completeUploadExternal": (args: Message) => {
      uploads.push(args);
      return answer(options.uploadComplete, { ok: true });
    },
  };
  const SLACK_API = "https://slack.com/api/";
  const fakeFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (!url.startsWith(SLACK_API)) {
      // The tree image upload.
      return new Response(null, { status: options.uploadStatus ?? 200 });
    }
    // The client form-encodes arguments, JSON encoding non-string values.
    const args: Message = {};
    for (const [key, value] of init?.body as URLSearchParams) {
      args[key] = /^[[{]|^\d+$|^(true|false)$/.test(value)
        ? JSON.parse(value)
        : value;
    }
    const resp = await api[url.slice(SLACK_API.length)](args);
    return Response.json(resp);
  };

  const original = {
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    log: console.log,
    warn: console.warn,
  };
  globalThis.fetch = fakeFetch;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).setTimeout = (fn: () => void) => {
    fn();
    return 0;
  };
  console.log = (msg: string) => logs.push(msg);
  console.warn = (msg: string) => logs.push(msg);
  try {
    const context = createContext({
      inputs: {
        channel: "C1",
        bar_chart_url: "https://chart",
        stats,
        ...inputs,
      } as Parameters<typeof createContext>[0]["inputs"],
    });
    const result = await postStatsMessage(context);
    // deno-lint-ignore no-explicit-any
    return { error: (result as any).error, posts, threads, uploads, logs };
  } finally {
    globalThis.fetch = original.fetch;
    globalThis.setTimeout = original.setTimeout;
    console.log = original.log;
    console.warn = original.warn;
  }
}

const text = (post: Message) => post.blocks[0].text.text as string;
const treeBlock = (post: Message) =>
  post.blocks.find((block: Message) => block.slack_file);

Deno.test("posts the summary with the chart and fun facts in a thread", async () => {
  const { error, posts, threads, uploads } = await run({});
  assertEquals(error, undefined);
  assertEquals(uploads.length, 0);
  assertEquals(posts.length, 1);
  assertEquals(posts[0].channel, "C1");
  assertEquals(posts[0].unfurl_links, false);
  assertEquals(
    text(posts[0]),
    "Total star progress of the team for day 3 is *55.56%*. " +
      "First participant to complete all tasks today was *Bob*, congrats! " +
      "Share your execution times in the thread.",
  );
  assertEquals(posts[0].blocks[1], {
    type: "image",
    image_url: "https://chart",
    alt_text: "daily star progress",
  });
  assertEquals(threads.length, 1);
  assertEquals(threads[0].thread_ts, "111.222");
  assertEquals(threads[0].text, "fact 1\nfact 2");
});

Deno.test("invites participants when nobody finished today", async () => {
  const { posts } = await run({
    stats: { ...stats, first_solution_today_by: undefined },
  });
  assert(
    text(posts[0]).includes("You still have a chance to be the first"),
    text(posts[0]),
  );
});

Deno.test("outside the event only the total progress is posted", async () => {
  const { posts, threads } = await run({
    stats: { ...stats, today: undefined, fun_facts: [] },
  });
  assertEquals(text(posts[0]), "Total star progress of the team is *55.56%*.");
  assertEquals(threads.length, 0);
});

Deno.test("embeds the uploaded pixel tree", async () => {
  const { error, posts, uploads, logs } = await run({
    members: [member(1), member(2)],
  });
  assertEquals(error, undefined);
  assertEquals(uploads[0].filename, "advent_tree_2025_day3.png");
  assert((uploads[0].length as number) > 0, "empty upload");
  assertEquals(uploads[1].files, [{ id: "F123", title: "Advent tree, day 3" }]);
  assertEquals(posts.length, 1);
  assertEquals(treeBlock(posts[0]), {
    type: "image",
    slack_file: { id: "F123" },
    alt_text:
      "pixel advent tree: one ornament per star, one snowflake per participant",
  });
  assert(logs.includes("Pixel tree embedded"), logs.join("\n"));
});

Deno.test("alt text says when the tree could not show everyone", async () => {
  const many = Array.from({ length: 1000 }, (_, i) => member(i));
  const { posts, logs } = await run({ members: many });
  assertEquals(
    treeBlock(posts[0]).alt_text,
    "pixel advent tree: ornaments for stars, snowflakes for participants (too many to show all)",
  );
  assert(logs.some((log) => log.startsWith("Pixel tree is full")), "warning");
});

Deno.test("retries while the fresh tree file is not usable yet", async () => {
  const { error, posts, logs } = await run({ members: [member(1)] }, {
    posts: [{ ok: false, error: "invalid_blocks" }],
  });
  assertEquals(error, undefined);
  assertEquals(posts.length, 2);
  assert(treeBlock(posts[1]) != null, "retry dropped the tree");
  assert(logs.includes("Pixel tree embedded after 1 retry"), logs.join("\n"));
});

Deno.test("posts without the tree after the retries run out", async () => {
  const invalid = { ok: false, error: "invalid_blocks" };
  const { error, posts, logs } = await run({ members: [member(1)] }, {
    posts: [invalid, invalid, invalid],
  });
  assertEquals(error, undefined);
  assertEquals(posts.length, 4);
  assertEquals(posts.slice(0, 3).every((p) => treeBlock(p) != null), true);
  assertEquals(treeBlock(posts[3]), undefined);
  assert(
    logs.some((log) => log.includes("still not accepted after 2 retries")),
    logs.join("\n"),
  );
});

Deno.test("fails when posting without the tree fails too", async () => {
  const invalid = { ok: false, error: "invalid_blocks" };
  const { error, posts, threads } = await run({ members: [member(1)] }, {
    posts: [invalid, invalid, invalid, invalid],
  });
  assertEquals(posts.length, 4);
  assertEquals(
    error,
    "Error posting summary to channel: C1. Error detail: invalid_blocks",
  );
  assertEquals(threads.length, 0);
});

Deno.test("does not retry errors the tree cannot cause", async () => {
  const { error, posts } = await run({ members: [member(1)] }, {
    posts: [{ ok: false, error: "channel_not_found" }],
  });
  assertEquals(posts.length, 1);
  assertEquals(
    error,
    "Error posting summary to channel: C1. Error detail: channel_not_found",
  );
});

const uploadFailures: [string, MockOptions, string][] = [
  [
    "upload URL request fails",
    { uploadStart: { ok: false, error: "not_allowed" } },
    "Error preparing tree upload: not_allowed",
  ],
  [
    "upload POST fails",
    { uploadStatus: 500 },
    "Error uploading tree image: 500",
  ],
  [
    "upload completion fails",
    { uploadComplete: { ok: false, error: "file_not_found" } },
    "Error finishing tree upload: file_not_found",
  ],
  [
    "upload throws",
    { uploadStart: new Error("boom") },
    "Failed to create pixel tree due to Error: boom",
  ],
];
for (const [name, options, warning] of uploadFailures) {
  Deno.test(`posts without the tree when the ${name}`, async () => {
    const { error, posts, logs } = await run({ members: [member(1)] }, options);
    assertEquals(error, undefined);
    assertEquals(posts.length, 1);
    assertEquals(treeBlock(posts[0]), undefined);
    assert(logs.includes(warning), logs.join("\n"));
  });
}

Deno.test("a failing fun facts thread does not fail the workflow", async () => {
  const notOk = await run({}, { thread: { ok: false, error: "msg_too_long" } });
  assertEquals(notOk.error, undefined);
  assert(
    notOk.logs.includes(
      "Error posting fun facts to thread 111.222. Error detail: msg_too_long",
    ),
    notOk.logs.join("\n"),
  );

  const thrown = await run({}, { thread: new Error("network") });
  assertEquals(thrown.error, undefined);
  assert(
    thrown.logs.includes(
      "Failed to post fun facts to thread due to Error: network",
    ),
    thrown.logs.join("\n"),
  );
});

Deno.test("reports an exception from postMessage", async () => {
  const { error } = await run({}, { posts: [new Error("socket hang up")] });
  assertEquals(error, "Failed to post statistics due to Error: socket hang up");
});
