import { DefineType, Schema } from "deno-slack-sdk/mod.ts";

export const LeaderboardCompletionLevelCustomType = DefineType({
  name: "LeaderboardCompletionLevel",
  type: Schema.types.object,
  properties: {
    day: {
      type: Schema.types.number,
    },
    star_1_timestamp: {
      type: Schema.types.number,
    },
    star_2_timestamp: {
      type: Schema.types.number,
    },
  },
  required: ["day"],
});

export const LeaderboardMemberCustomType = DefineType({
  name: "LeaderboardMember",
  type: Schema.types.object,
  properties: {
    completion_day_level: {
      type: Schema.types.string,
    },
    name: {
      type: Schema.types.string,
    },
    stars: {
      type: Schema.types.number,
    },
  },
  required: ["completion_day_level", "name", "stars"],
});

// Define the array with the items as the custom type
export const LeaderboardMemberArrayType = DefineType({
  name: "LeaderboardMemberArray",
  type: Schema.types.array,
  items: {
    type: LeaderboardMemberCustomType,
  },
});