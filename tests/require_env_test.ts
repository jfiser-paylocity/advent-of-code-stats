import { requireEnv } from "../triggers/require_env.ts";

const NAME = "AOC_STATS_REQUIRE_ENV_TEST";

Deno.test("requireEnv returns a set variable", () => {
  Deno.env.set(NAME, "value");
  try {
    const value = requireEnv(NAME);
    if (value !== "value") throw new Error(`got ${value}`);
  } finally {
    Deno.env.delete(NAME);
  }
});

for (const [label, value] of [["unset", undefined], ["empty", ""]]) {
  Deno.test(`requireEnv throws when the variable is ${label}`, () => {
    if (value == null) Deno.env.delete(NAME);
    else Deno.env.set(NAME, value);
    try {
      requireEnv(NAME);
      throw new Error("did not throw");
    } catch (err) {
      const message = (err as Error).message;
      if (!message.startsWith(`Missing env var ${NAME}.`)) throw err;
    } finally {
      Deno.env.delete(NAME);
    }
  });
}
