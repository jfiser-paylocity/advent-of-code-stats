import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { LeaderboardMemberArrayType } from "../types/leaderboard.ts";

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
      members: {
        type: LeaderboardMemberArrayType,
        description: "Leaderboard members",
      },
    },
    required: ["members"],
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
      "User-Agent": "github.com/jfiser-paylocity/advent-of-code-stats"
    };
    try {
      const endpoint = `https://adventofcode.com/2023/leaderboard/private/view/${inputs.leaderboard_id}.json`;
      const response = await fetch(endpoint, { method: "GET", headers: headers, credentials: "include" });
      if (response.status != 200) {
        // In the case where the API responded with non 200 status
        const body = await response.text();
        const error =
          `Failed to call AoC API (status: ${response.status}, body: ${body})`;
        return { error };
      }
      
      // Map to custom type
      const data = await response.json();
      const members = Object.values(data.members).map((member) => {
        return {
          completion_day_level: Object.entries(member.completion_day_level).map(([day, levels]) => {
            return {
              day: +day,
              star_1_timestamp: levels["1"]?.get_star_ts,
              star_2_timestamp: levels["2"]?.get_star_ts,
            };
          }),
          name: member.name,
          stars: member.stars,
        };
      });

      return { outputs: { members } };
    } catch (err) {
      const error = `Failed to call AoC API due to ${err}`;
      return { error };
    };
  },
);