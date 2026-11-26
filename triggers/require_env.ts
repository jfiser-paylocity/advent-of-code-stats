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
