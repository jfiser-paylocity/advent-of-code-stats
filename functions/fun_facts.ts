// Pure helpers that turn leaderboard data into short "fun fact" lines.
// No Slack imports so they can be unit tested directly.
import { DAY_SECONDS, publishTimestamp } from "./aoc_time.ts";
import { displayName, type Member, sharePercent } from "./members.ts";

type CompletionLevel = Member["completion_day_level"][number];

export interface FunFactOptions {
  /** Current puzzle day (1-based). */
  day: number;
  /** Event year. */
  year: number;
  /** Current time in milliseconds. */
  now: number;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}

interface Solve {
  member: Member;
  day: number;
  seconds: number;
  /** When the star was earned, in seconds. */
  finishedAt: number;
}

/** One solve per completion level for which `timing` returns a start and end. */
function collectSolves(
  members: Member[],
  timing: (level: CompletionLevel) => [number, number] | undefined,
): Solve[] {
  return members.flatMap((member) =>
    member.completion_day_level.flatMap((level) => {
      const span = timing(level);
      return span
        ? [{
          member,
          day: level.day,
          seconds: span[1] - span[0],
          finishedAt: span[1],
        }]
        : [];
    })
  );
}

/** Part 1: from puzzle unlock to the first star. */
const part1Solves = (members: Member[], year: number) =>
  collectSolves(
    members,
    (level) =>
      level.star_1_timestamp !== undefined
        ? [publishTimestamp(year, level.day), level.star_1_timestamp]
        : undefined,
  );

/** Part 2: from the first star to the second. */
const part2Solves = (members: Member[]) =>
  collectSolves(members, (level) =>
    level.star_1_timestamp !== undefined &&
      level.star_2_timestamp !== undefined
      ? [level.star_1_timestamp, level.star_2_timestamp]
      : undefined);

/** "*A*, *B* and *C*", or "*A*, *B*, *C* and 4 more" past `limit` names. */
function joinNames(names: string[], limit: number): string {
  if (names.length > limit) {
    return `${names.slice(0, limit).join(", ")} and ${
      names.length - limit
    } more`;
  }
  if (names.length > 1) {
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  return names[0];
}

function recordLine(prefix: string, best: Solve | undefined) {
  return best
    ? `${prefix}: *${displayName(best.member)}*, ${
      formatDuration(best.seconds)
    } (day ${best.day}).`
    : undefined;
}

function fastest(solves: Solve[]): Solve | undefined {
  let best: Solve | undefined;
  for (const solve of solves) {
    if (!best || solve.seconds < best.seconds) {
      best = solve;
    }
  }
  return best;
}

export function biggestGain(
  members: Member[],
  now: number,
): string | undefined {
  const since = now / 1000 - DAY_SECONDS;
  const counts = new Map<
    string,
    { day: number; part: number; count: number }
  >();
  const add = (day: number, part: number, timestamp?: number) => {
    if (timestamp === undefined || timestamp < since) {
      return;
    }
    const key = `${day}-${part}`;
    const entry = counts.get(key) ?? { day, part, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  };
  for (const member of members) {
    for (const level of member.completion_day_level) {
      add(level.day, 1, level.star_1_timestamp);
      add(level.day, 2, level.star_2_timestamp);
    }
  }
  let best: { day: number; part: number; count: number } | undefined;
  for (const entry of counts.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count &&
        (entry.day < best.day ||
          (entry.day === best.day && entry.part < best.part)))
    ) {
      best = entry;
    }
  }
  if (!best) {
    return undefined;
  }
  return `📈 Biggest gain of the day: day ${best.day} part ${best.part}, +${best.count} new ${
    best.count === 1 ? "star" : "stars"
  }.`;
}

/**
 * Only jumps completed since today's puzzle was published count as "today".
 * Once the puzzle's 24 hour window is over (or before it opens), there is no "today".
 */
export function fastestJumpToday(
  members: Member[],
  { day, year, now }: FunFactOptions,
): string | undefined {
  const since = publishTimestamp(year, day);
  const nowSeconds = now / 1000;
  if (nowSeconds < since || nowSeconds >= since + DAY_SECONDS) {
    return undefined;
  }
  const best = fastest(
    part2Solves(members).filter((s) =>
      s.finishedAt >= since && s.finishedAt <= nowSeconds
    ),
  );
  if (!best) {
    return undefined;
  }
  return `⚡ Fastest jump from ⭐ to ⭐⭐ today: *${
    displayName(best.member)
  }*, ${formatDuration(best.seconds)}.`;
}

export function fastestPart1Record(
  members: Member[],
  year: number,
): string | undefined {
  return recordLine(
    "🥇 Fastest part 1 this year",
    fastest(part1Solves(members, year)),
  );
}

export function fastestPart2Record(
  members: Member[],
): string | undefined {
  return recordLine(
    "🥈 Fastest part 2 this year",
    fastest(part2Solves(members)),
  );
}

function currentStreak(member: Member, day: number): number {
  const completed = new Set(
    member.completion_day_level
      .filter((l) =>
        l.star_1_timestamp !== undefined && l.star_2_timestamp !== undefined
      )
      .map((l) => l.day),
  );
  // Today's puzzle may not be solved yet, do not break the streak because of it.
  let d = completed.has(day) ? day : day - 1;
  let streak = 0;
  while (d >= 1 && completed.has(d)) {
    streak += 1;
    d -= 1;
  }
  return streak;
}

export function streakLeaders(
  members: Member[],
  day: number,
): string | undefined {
  let max = 0;
  let leaders: Member[] = [];
  for (const member of members) {
    const streak = currentStreak(member, day);
    if (streak > max) {
      max = streak;
      leaders = [member];
    } else if (streak === max && streak > 0) {
      leaders.push(member);
    }
  }
  if (max < 2) {
    return undefined;
  }
  const names = leaders.map((m) => `*${displayName(m)}*`).sort();
  return `🔥 Longest streak: ${
    joinNames(names, 3)
  }, ${max} days with both stars.`;
}

export function hardestDay(
  members: Member[],
  day: number,
): string | undefined {
  if (members.length === 0) {
    return undefined;
  }
  let best:
    | { day: number; silver: number; gold: number; gap: number }
    | undefined;
  for (let d = 1; d <= day; d++) {
    let silver = 0;
    let gold = 0;
    for (const member of members) {
      const level = member.completion_day_level.find((l) => l.day === d);
      if (level?.star_1_timestamp !== undefined) silver += 1;
      if (level?.star_2_timestamp !== undefined) gold += 1;
    }
    if (silver === 0) {
      continue;
    }
    const gap = silver - gold;
    if (!best || gap > best.gap) {
      best = { day: d, silver, gold, gap };
    }
  }
  if (!best || best.gap <= 0) {
    return undefined;
  }
  // Round each share first, then subtract, so the figure matches the chart.
  const percent = sharePercent(best.silver, members.length) -
    sharePercent(best.gold, members.length);
  return `🧱 Toughest part 2 so far: day ${best.day}, ${percent}% of participants solved part 1 but not part 2 (${best.silver} ⭐ → ${best.gold} ⭐⭐).`;
}

export function topThree(members: Member[]): string | undefined {
  const ranked = members
    .map((m) => ({ name: displayName(m), score: m.local_score ?? m.stars }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3);
  // Sorted descending, so a zero top score means everyone has zero.
  if (ranked.length === 0 || ranked[0].score === 0) {
    return undefined;
  }
  return `🏆 Top ${ranked.length}: ${
    ranked.map((r) => `${r.name} ${r.score}`).join(", ")
  }`;
}

export function nonParticipants(members: Member[]): string | undefined {
  const names = members
    .filter((m) => m.stars === 0 && m.completion_day_level.length === 0)
    .map((m) => `*${displayName(m)}*`)
    .sort();
  if (names.length === 0) {
    return undefined;
  }
  return `👻 No stars yet this year: ${joinNames(names, 5)}.`;
}

export function buildFunFacts(
  members: Member[],
  { day, year, now }: FunFactOptions,
): string[] {
  return [
    biggestGain(members, now),
    fastestJumpToday(members, { day, year, now }),
    fastestPart1Record(members, year),
    fastestPart2Record(members),
    streakLeaders(members, day),
    hardestDay(members, day),
    topThree(members),
    nonParticipants(members),
  ].filter((line): line is string => line !== undefined);
}
