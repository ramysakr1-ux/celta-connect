// Rasterises the role shortcut icons (design_handoff_role_shortcuts, 17 Sep
// 2026) from their SVG masters into public/icons/.
//
// Three drawings per role, because the small sizes are the whole problem:
// the 512 master (full mark + badge letter) serves 512 and 192; the 32
// master (no badge -- a letter at that size is ~7px of dirt) serves 48 and
// 32; the 16 master (one arc -- two close into a blob) serves 16.
//
// The badge letter is live <text> in Karla in the masters. sharp's renderer
// would substitute whatever font it has, so the letter is turned into a
// path from Karla Bold first (fontkit), centred on the badge by its own
// bounding box -- which is what a badge letter is: the capital sitting in
// the middle of its tile.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createRequire } from "node:module";
const fontkit = createRequire(import.meta.url)("fontkit");

const SRC = "design-sources/role-shortcut-icons";
const OUT = "public/icons";
const SLUGS = ["candidate", "trainer-mct", "trainer-act", "volunteer", "student", "centre", "owner"];
const font = fontkit.openSync(path.join(SRC, "karla-700.ttf"));

function letterToPath(svg) {
  return svg.replace(/<text x="([\d.]+)" y="([\d.]+)" fill="(#[0-9a-f]+)"[^>]*font-size="([\d.]+)"[^>]*>([A-Z])<\/text>/, (_, x, y, fill, size, letter) => {
    const glyph = font.glyphsForString(letter)[0];
    const s = Number(size) / font.unitsPerEm;
    const b = glyph.bbox; // font units, y up
    const cx = ((b.minX + b.maxX) / 2) * s;
    const cy = ((b.minY + b.maxY) / 2) * s;
    // Flip y (font space is y-up), then place the glyph's centre on (x, y).
    return `<path transform="translate(${Number(x) - cx} ${Number(y) + cy}) scale(${s} ${-s})" d="${glyph.path.toSVG()}" fill="${fill}"/>`;
  });
}

function master(slug, drawing) {
  const raw = fs.readFileSync(path.join(SRC, `connect-${slug}-${drawing}.svg`), "utf8");
  // The masters carry a C2PA provenance block; it is not part of the drawing.
  return letterToPath(raw.replace(/<metadata>[\s\S]*?<\/metadata>/, ""));
}

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const slug of SLUGS) {
  const plan = [
    [512, master(slug, 512)],
    [192, master(slug, 512)],
    [48, master(slug, 32)],
    [32, master(slug, 32)],
    [16, master(slug, 16)],
  ];
  for (const [px, svg] of plan) {
    await sharp(Buffer.from(svg), { density: 384 }).resize(px, px).png().toFile(path.join(OUT, `connect-${slug}-${px}.png`));
    n++;
  }
}
console.log(`export-role-icons: ${n} PNGs -> ${OUT}/`);
