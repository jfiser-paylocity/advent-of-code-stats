import "@std/dotenv/load";

/**
 * Read an env var needed to build a trigger definition (from the shell or
 * `.env`). Fails with a clear message instead of creating a trigger with an
 * `undefined` input.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Set it in .env (see .env.example) or the shell.`,
    );
  }
  return value;
}

/**
 * Read a comma-separated list of numeric IDs (e.g. leaderboard IDs). Trims
 * whitespace, drops empty entries and duplicates, rejects non-numeric values.
 */
export function requireEnvList(name: string): string[] {
  const ids = [
    ...new Set(
      requireEnv(name).split(",").map((v) => v.trim()).filter(Boolean),
    ),
  ];
  const bad = ids.find((v) => !/^\d+$/.test(v));
  if (ids.length === 0 || bad !== undefined) {
    throw new Error(
      `Env var ${name} must be a comma-separated list of numeric IDs, got ${
        bad !== undefined ? `"${bad}"` : "no IDs"
      }.`,
    );
  }
  return ids;
}
