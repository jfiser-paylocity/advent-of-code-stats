import { requireEnv, requireEnvList } from "../triggers/require_env.ts";

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

for (
  const [label, raw, expected] of [
    ["single", "123", ["123"]],
    ["multiple with whitespace", " 1, 2 ,3 ", ["1", "2", "3"]],
    ["duplicates and empty entries", "1,,2,1,", ["1", "2"]],
  ] as const
) {
  Deno.test(`requireEnvList parses ${label}`, () => {
    Deno.env.set(NAME, raw);
    try {
      const got = requireEnvList(NAME);
      if (got.join("|") !== expected.join("|")) {
        throw new Error(`got ${got}`);
      }
    } finally {
      Deno.env.delete(NAME);
    }
  });
}

for (const raw of ["abc", "1,x", ",", "12a"]) {
  Deno.test(`requireEnvList rejects "${raw}"`, () => {
    Deno.env.set(NAME, raw);
    try {
      requireEnvList(NAME);
      throw new Error("did not throw");
    } catch (err) {
      if (!(err as Error).message.includes("comma-separated list")) throw err;
    } finally {
      Deno.env.delete(NAME);
    }
  });
}
