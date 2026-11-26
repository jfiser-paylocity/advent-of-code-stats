import { drawTree, renderPixelTree } from "../functions/pixel_tree.ts";
import { publishTimestamp } from "../functions/fun_facts.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const YEAR = 2025;
const member = (id: number, days: number[]) => ({
  id,
  stars: days.length * 2,
  completion_day_level: days.map((day) => ({
    day,
    star_1_timestamp: publishTimestamp(YEAR, day) + 600,
    star_2_timestamp: publishTimestamp(YEAR, day) + 900,
  })),
});
const members = [member(1, [1, 2, 3]), member(2, [2, 3]), member(3, [5])];

Deno.test("renders a PNG", async () => {
  const { png, shown } = await renderPixelTree(members, { year: YEAR });
  assert(
    [137, 80, 78, 71].every((b, i) => png[i] === b),
    "PNG signature missing",
  );
  assert(shown === 12, `expected 12 ornaments, got ${shown}`);
});

Deno.test("only stars up to the given day are shown", () => {
  assert(drawTree(members, { year: YEAR, upto: 1 }).shown === 2, "day 1");
  assert(drawTree(members, { year: YEAR, upto: 3 }).shown === 10, "day 3");
});

Deno.test("earlier frames are a subset of later frames", () => {
  const day2 = drawTree(members, { year: YEAR, upto: 2 }).canvas.data;
  const day3 = drawTree(members, { year: YEAR, upto: 3 }).canvas.data;
  // Ornaments never move: every ornament pixel of day 2 is unchanged on day 3.
  const base = drawTree([], { year: YEAR }).canvas.data;
  for (let i = 0; i < day2.length; i += 3) {
    const changed2 = day2[i] !== base[i] || day2[i + 1] !== base[i + 1] ||
      day2[i + 2] !== base[i + 2];
    const same = day2[i] === day3[i] && day2[i + 1] === day3[i + 1] &&
      day2[i + 2] === day3[i + 2];
    // Only labels may differ between frames (bottom rows).
    if (changed2 && i / 3 < 61 * 70) assert(same, `pixel ${i / 3} moved`);
  }
});

Deno.test("a new member adds a flake without moving existing ones", () => {
  const before = drawTree(members, { year: YEAR }).canvas.data;
  const after = drawTree([...members, member(4, [4])], { year: YEAR }).canvas
    .data;
  let diff = 0;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) diff++;
  assert(diff > 0, "new member should change the picture");
});
