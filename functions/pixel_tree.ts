import { DAY_SECONDS, EVENT_DAYS, publishTimestamp } from "./aoc_time.ts";
import type { Member } from "./members.ts";

/**
 * Pixel-art advent tree. One ornament per solved star, one snowflake per
 * leaderboard member. Pure TypeScript, no dependencies: renders to a small RGB
 * canvas, scales it up without smoothing and encodes a PNG.
 */

export type PixelTreeOptions = {
  year: number;
  /** Only show stars (and members that joined) up to and including this day. */
  upto?: number;
  /** Total number of days of the event. */
  days?: number;
  /** PNG upscale factor. */
  scale?: number;
};

type RGB = [number, number, number];

const W = 61;
const H = 76;
// Snowflakes are 3x3: gap 4 leaves a 1px air gap, margin keeps them off the tree.
const FLAKE_GAP = 4;
const TREE_MARGIN = 3;
const GOLD: RGB = [255, 215, 0];
const SKY: RGB = [12, 18, 45];
const PALETTE: RGB[] = [
  [255, 99, 99],
  [99, 200, 255],
  [120, 230, 120],
  [255, 170, 60],
  [200, 130, 255],
  [255, 120, 200],
  [90, 230, 210],
  [230, 230, 110],
  [160, 160, 255],
  [200, 200, 200],
];

// 3x5 glyphs, rows separated by "/".
const FONT: Record<string, string> = {
  "A": ".#./#.#/###/#.#/#.#",
  "D": "##./#.#/#.#/#.#/##.",
  "Y": "#.#/#.#/.#./.#./.#.",
  " ": ".../.../.../.../...",
  "0": "###/#.#/#.#/#.#/###",
  "1": ".#./##./.#./.#./###",
  "2": "##./..#/.#./#../###",
  "3": "##./..#/.#./..#/##.",
  "4": "#.#/#.#/###/..#/..#",
  "5": "###/#../##./..#/##.",
  "6": ".##/#../###/#.#/###",
  "7": "###/..#/.#./.#./.#.",
  "8": "###/#.#/###/#.#/###",
  "9": "###/#.#/###/..#/##.",
};

/** Small deterministic PRNG so the layout is stable between runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

class Canvas {
  readonly data: Uint8Array;
  constructor(readonly w: number, readonly h: number, bg: RGB) {
    this.data = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) this.data.set(bg, i * 3);
  }
  px(x: number, y: number, c: RGB) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
      this.data.set(c, (y * this.w + x) * 3);
    }
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
    }
  }
  text(x: number, y: number, text: string, c: RGB) {
    for (const ch of text.toUpperCase()) {
      const rows = (FONT[ch] ?? FONT[" "]).split("/");
      rows.forEach((row, r) =>
        [...row].forEach((v, k) => {
          if (v === "#") this.px(x + k, y + r, c);
        })
      );
      x += 4;
    }
  }
}

const dim = (
  c: RGB,
  f: number,
): RGB => [Math.floor(c[0] * f), Math.floor(c[1] * f), Math.floor(c[2] * f)];
const lighten = (c: RGB): RGB => [
  (c[0] + 255) >> 1,
  (c[1] + 255) >> 1,
  (c[2] + 255) >> 1,
];

type Star = { day: number; part: 1 | 2; ts: number; color: RGB };

export type TreeScene = {
  stars: Star[];
  flakes: { x: number; y: number; color: RGB; joinDay?: number }[];
  total: number;
  /** Members without a snowflake because the sky is full. */
  droppedFlakes: number;
};

/** Layout of the tree area: pixels that are green and pixels for ornaments. */
function treeCells() {
  const cx = (W - 1) / 2;
  const tiers = [[10, 30, 3, 15], [24, 46, 4, 21], [40, 62, 5, 28]];
  const shade = new Map<string, RGB>();
  const cells: [number, number][] = [];
  for (const [y0, y1, w0, w1] of tiers) {
    for (let y = y0; y < y1; y++) {
      const half = Math.floor(w0 + (w1 - w0) * (y - y0) / (y1 - y0 - 1));
      for (let x = cx - half; x <= cx + half; x++) {
        cells.push([x, y]);
        shade.set(`${x},${y}`, [22, 110 + (x * 7 + y * 3) % 30, 50]);
      }
    }
  }
  return { cx, cells, shade };
}

export function buildScene(
  members: Member[],
  { year, days = EVENT_DAYS }: PixelTreeOptions,
): TreeScene & { positions: [number, number][] } {
  const { cx, cells, shade } = treeCells();
  const ranked = members
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.stars - a.m.stars || a.i - b.i);
  const colorOf = new Map<Member, RGB>();
  ranked.forEach(({ m }, i) => colorOf.set(m, PALETTE[i % PALETTE.length]));

  // Stars sorted by (day, timestamp): the stars of days <= N are always a
  // prefix, so ornaments never move between daily frames.
  const stars: Star[] = [];
  for (const m of members) {
    for (const level of m.completion_day_level) {
      for (const part of [1, 2] as const) {
        const ts = level[`star_${part}_timestamp`];
        if (ts != null) {
          stars.push({ day: level.day, part, ts, color: colorOf.get(m)! });
        }
      }
    }
  }
  stars.sort((a, b) => a.day - b.day || a.ts - b.ts);

  // Ornament positions: partial Fisher-Yates over the inner tree cells.
  const inner = cells.filter(([x, y]) =>
    y > 11 && shade.has(`${x + 1},${y}`) && shade.has(`${x - 1},${y}`)
  );
  const rnd = mulberry32(12);
  const count = Math.min(stars.length, inner.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rnd() * (inner.length - i));
    [inner[i], inner[j]] = [inner[j], inner[i]];
  }

  // One snowflake per member, seeded by the member id so positions are stable
  // when others join. Join day is not in the API: use the member's first star.
  const blocked = (x: number, y: number) => {
    if (y < 14 && Math.abs(x - cx) < 6) return true;
    for (let dx = -TREE_MARGIN; dx <= TREE_MARGIN; dx++) {
      for (let dy = -TREE_MARGIN; dy <= TREE_MARGIN; dy++) {
        if (shade.has(`${x + dx},${y + dy}`)) return true;
      }
    }
    return false;
  };
  const placed: [number, number][] = [];
  const flakes: TreeScene["flakes"] = [];
  const ordered = members
    .map((m, i) => ({ m, seed: m.id ?? hashString(`${m.name ?? ""}#${i}`) }))
    .sort((a, b) => a.seed - b.seed);
  const published1 = publishTimestamp(year, 1);
  for (const { m, seed } of ordered) {
    const r = mulberry32(seed);
    let spot: [number, number] | undefined;
    for (let attempt = 0; attempt < 500 && !spot; attempt++) {
      const x = 2 + Math.floor(r() * (W - 4));
      const y = 2 + Math.floor(r() * 64);
      if (
        !blocked(x, y) &&
        placed.every(([px, py]) =>
          Math.abs(x - px) > FLAKE_GAP || Math.abs(y - py) > FLAKE_GAP
        )
      ) {
        spot = [x, y];
      }
    }
    if (!spot) continue;
    placed.push(spot);
    const times = m.completion_day_level.flatMap((l) =>
      [l.star_1_timestamp, l.star_2_timestamp].filter((t): t is number =>
        t != null
      )
    );
    const first = times.length ? Math.min(...times) : undefined;
    const joinDay = first == null ? undefined : Math.min(
      days,
      Math.max(1, Math.floor((first - published1) / DAY_SECONDS) + 1),
    );
    const base = colorOf.get(m)!;
    flakes.push({
      x: spot[0],
      y: spot[1],
      // Unknown join time (no stars yet): dim "ghost" flake in every frame.
      color: joinDay == null ? dim(base, 0.45) : lighten(base),
      joinDay,
    });
  }
  return {
    stars,
    flakes,
    total: stars.length,
    droppedFlakes: members.length - flakes.length,
    positions: inner.slice(0, count),
  };
}

export function drawTree(
  members: Member[],
  options: PixelTreeOptions,
): TreeDrawing & { canvas: Canvas } {
  const { upto } = options;
  const scene = buildScene(members, options);
  const { cx, cells, shade } = treeCells();
  const c = new Canvas(W, H, SKY);

  // Faint ambient snow, fixed layout.
  const rnd = mulberry32(99);
  for (let i = 0; i < 45; i++) {
    c.px(Math.floor(rnd() * W), Math.floor(rnd() * (H - 8)), [120, 130, 170]);
  }
  for (const [x, y] of cells) c.px(x, y, shade.get(`${x},${y}`)!);
  c.rect(cx - 3, 62, 7, 8, [110, 70, 35]); // trunk
  c.rect(0, 70, W, 6, [235, 240, 250]); // snow on the ground
  for (
    const [dx, dy] of [
      [0, 0],
      [-1, 1],
      [1, 1],
      [0, 1],
      [0, 2],
      [-2, 2],
      [2, 2],
      [-1, -1],
      [1, -1],
      [0, -2],
      [0, -3],
    ]
  ) c.px(cx + dx, 6 + dy, GOLD); // topper

  for (const f of scene.flakes) {
    if (upto != null && f.joinDay != null && f.joinDay > upto) continue;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      c.px(f.x + dx, f.y + dy, f.color);
    }
    for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      c.px(f.x + dx, f.y + dy, dim(f.color, 0.7));
    }
  }

  let shown = 0;
  let hiddenStars = 0;
  scene.stars.forEach((s, i) => {
    if (upto != null && s.day > upto) return;
    const pos = scene.positions[i];
    if (!pos) {
      // The tree has no free cell left for this ornament.
      hiddenStars++;
      return;
    }
    shown++;
    c.px(pos[0], pos[1], s.color);
    if (s.part === 2) c.px(pos[0], pos[1] - 1, dim(s.color, 0.6));
  });

  if (upto != null) {
    c.text(2, 71, `DAY ${upto}`, [150, 30, 30]);
    // Real star count, even when not every star fits on the tree.
    const label = `${shown + hiddenStars}`;
    c.text(W - 2 - 4 * label.length, 71, label, [20, 30, 70]);
  }
  return {
    canvas: c,
    shown,
    hiddenStars,
    droppedFlakes: scene.droppedFlakes,
  };
}

export type TreeDrawing = {
  /** Ornaments drawn. */
  shown: number;
  /** Stars that did not fit on the tree. */
  hiddenStars: number;
  /** Members that did not get a snowflake. */
  droppedFlakes: number;
};

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  // "deflate" in the Compression Streams API is the zlib format PNG needs.
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(
    new CompressionStream("deflate"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodePng(canvas: Canvas, scale: number) {
  const w = canvas.w * scale;
  const h = canvas.h * scale;
  const raw = new Uint8Array((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < canvas.h; y++) {
    const row = new Uint8Array(w * 3 + 1); // filter byte 0
    for (let x = 0; x < canvas.w; x++) {
      const px = canvas.data.subarray(
        (y * canvas.w + x) * 3,
        (y * canvas.w + x) * 3 + 3,
      );
      for (let s = 0; s < scale; s++) row.set(px, 1 + (x * scale + s) * 3);
    }
    for (let s = 0; s < scale; s++) {
      raw.set(row, o);
      o += row.length;
    }
  }
  const chunk = (type: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    out.set([...type].map((ch) => ch.charCodeAt(0)), 4);
    out.set(body, 8);
    view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflate(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

/** Render the tree as a PNG. `upto` limits it to the state after that day. */
export async function renderPixelTree(
  members: Member[],
  options: PixelTreeOptions,
): Promise<TreeDrawing & { png: Uint8Array }> {
  const { canvas, ...drawing } = drawTree(members, options);
  return { png: await encodePng(canvas, options.scale ?? 10), ...drawing };
}
