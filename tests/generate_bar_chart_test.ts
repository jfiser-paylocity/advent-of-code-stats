import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import generateBarChart, {
  GenerateBarChartFunctionDefinition,
} from "../functions/generate_bar_chart.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const { createContext } = SlackFunctionTester(
  GenerateBarChartFunctionDefinition,
);

const baseStats = {
  progress: 42.5,
  total_participants: 7,
  days_released: 3,
  today: 3,
  year: 2025,
  daily_silver_stars: [90, 80, 70, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  daily_gold_stars: [85, 60, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

async function chart(stats: typeof baseStats | Record<string, unknown>) {
  const result = await generateBarChart(
    // deno-lint-ignore no-explicit-any
    createContext({ inputs: { stats: stats as any } }),
  );
  // deno-lint-ignore no-explicit-any
  const url = new URL((result as any).outputs.chart_url);
  return { url, config: url.searchParams.get("c") ?? "" };
}

Deno.test("builds a quickchart.io PNG URL", async () => {
  const { url } = await chart(baseStats);
  assert(url.origin === "https://quickchart.io", url.origin);
  assert(url.pathname === "/chart", url.pathname);
  assert(url.searchParams.get("f") === "png", "format");
  assert(url.searchParams.get("bkg") === "#0f0f23", "background");
});

Deno.test("config is minified and has the formatters substituted", async () => {
  const { config } = await chart(baseStats);
  assert(!config.includes("\n"), "config contains newlines");
  assert(!config.includes("<label_formatter>"), "label formatter left");
  assert(!config.includes("<tick_formatter>"), "tick formatter left");
  assert(
    config.includes("function(v){return v==null?'':v+'%'}"),
    "label formatter missing",
  );
});

Deno.test("unreleased days have no bars and a trailing empty slot", async () => {
  const { config } = await chart(baseStats);
  const nulls = Array(9).fill(null);
  assert(
    config.includes(`data:${JSON.stringify([90, 80, 70, ...nulls, null])}`),
    "silver series",
  );
  assert(
    config.includes(`data:${JSON.stringify([85, 60, 30, ...nulls, null])}`),
    "gold series",
  );
  assert(
    config.includes(
      `labels:${JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, ""])}`,
    ),
    "labels",
  );
});

Deno.test("title, subtitle and average line reflect the stats", async () => {
  const { config } = await chart(baseStats);
  assert(config.includes("Advent of Code 2025 · daily star progress"), "title");
  assert(
    config.includes("7 participants · 3 of 12 days released"),
    "subtitle",
  );
  assert(config.includes("value:42.5"), "average value");
  assert(config.includes("content:'42.5%'"), "average label");
});

Deno.test("subtitle omits participants when unknown", async () => {
  const { total_participants: _, ...stats } = baseStats;
  const { config } = await chart(stats);
  assert(!config.includes("participants ·"), "participants shown");
  assert(config.includes("3 of 12 days released"), "subtitle");
});

Deno.test("URL fits Slack's 3000 character image_url limit", async () => {
  const full = {
    ...baseStats,
    total_participants: 999,
    days_released: 12,
    progress: 99.99,
    daily_silver_stars: Array(12).fill(100),
    daily_gold_stars: Array(12).fill(100),
  };
  const { url } = await chart(full);
  assert(url.href.length <= 3000, `URL is ${url.href.length} characters`);
});
