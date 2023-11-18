import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const FetchLeaderboardFunctionDefinition = DefineFunction({
  callback_id: "fetch_leaderboard",
  title: "Fetch leaderboard",
  source_file: "functions/fetch_leaderboard.ts",
  input_parameters: {
    properties: {
      leaderboard_id: {
        type: Schema.types.string,
        description: "Leaderboard ID",
      },
    },
    required: ["leaderboard_id"],
  },
  output_parameters: {
    properties: {
      leaderboard: {
        type: Schema.types.object,
        description: "Leaderboard data",
      },
    },
    required: ["leaderboard"],
  },
});

export default SlackFunction(
  // Pass along the function definition from earlier in the source file
  FetchLeaderboardFunctionDefinition,
  async ({ inputs, env }) => { // Provide any context properties, like `inputs`, `env`, or `token`
    // Implement your function
    const headers = {
      "Cookie": `session=${env.ADVENT_OF_CODE_STATS_SESSION_COOKIE}`,
      "Content-Type": "application/json",
    };
    try {
      const endpoint = `https://adventofcode.com/2023/leaderboard/private/view/${inputs.leaderboard_id}.json`;
      const response = await fetch(endpoint, { method: "GET", headers });
      if (response.status != 200) {
        // In the case where the API responded with non 200 status
        const body = await response.text();
        const error =
          `Failed to call AoC API (status: ${response.status}, body: ${body})`;
        return { error };
      }
      // Do cool stuff with your repo info here
      const data = await response.json();

      return { outputs: { data } };
    } catch (err) {
      const error = `Failed to call AoC API due to ${err}`;
      return { error };
    };
  },
);