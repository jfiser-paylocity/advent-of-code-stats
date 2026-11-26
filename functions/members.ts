// Shared leaderboard member shape and helpers. Pure, no Slack imports.

/** Plain TypeScript view of the LeaderboardMember custom type. */
export type Member = {
  id?: number;
  name?: string;
  stars: number;
  local_score?: number;
  completion_day_level: {
    day: number;
    star_1_timestamp?: number;
    star_2_timestamp?: number;
  }[];
};

export const displayName = (member: { name?: string }) =>
  member.name || "Anonymous";

/** Whole-number share of `total`, 0 when `total` is 0 (instead of NaN). */
export const sharePercent = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;
