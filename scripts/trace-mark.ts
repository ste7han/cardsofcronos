// The old mark, turned into a real vector.
//
//   npx tsx scripts/trace-mark.ts
//
// legacy/public/logo.svg is not a vector. It is four base64 PNGs of 270x229 in
// an SVG wrapper, and 270 pixels is not enough for a card back that has to be
// crisp at 39px in the opponent's hand and at three times a card's width on an
// NFT render. Redrawing it by eye would get a hexagon that is nearly the old
// one, which is worse than either keeping it or replacing it.
//
// So it is traced. Rasterise the wrapper large, where the browser's own scaling
// smooths the edges, threshold that to a mask, walk the boundary, and drop the
// points that sit on a line their neighbours already describe. The shape is
// made of straight edges, so what comes out is short.
//
// The last step is the point: the traced path is rendered back and compared to
// the original pixel by pixel. A trace nobody checked is a drawing.

import { writeFileSync, readFileSync } from "node:fs";

import { chromium } from "playwright";

const SRC = "legacy/public/logo.svg";
const OUT = "components/CronosMark.tsx";
/** Big enough that the browser's smoothing does the anti-aliasing for us. */
const RASTER = 1600;
/** How far a point may sit off the line between its neighbours, in raster px. */
const TOLERANCE = 3;

async function main() {
  const svg = readFileSync(SRC, "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: RASTER, height: RASTER } });

  await page.setContent(
    `<body style="margin:0;width:${RASTER}px;height:${RASTER}px;background:#000">
       <div style="width:100%;height:100%">${svg.replace(/width="\d+"/, `width="${RASTER}"`).replace(/height="\d+"/, `height="${RASTER}"`)}</div>
     </body>`,
  );
  await page.waitForTimeout(300);
  const shot = await page.screenshot({ type: "png" });

  const traced = await page.evaluate(
    async ({ data, tolerance }) => {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(data)], { type: "image/png" }));
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const W = c.width, H = c.height;

      // The mask. The wrapper paints purple on black, so luminance separates
      // them; halfway up the mark's own brightness is where the edge sits.
      const mask = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const lum = ((px[i * 4] ?? 0) + (px[i * 4 + 1] ?? 0) + (px[i * 4 + 2] ?? 0)) / 3;
        mask[i] = lum > 46 ? 1 : 0;
      }

      // Holes count as shapes.
      //
      // The first version of this walked one boundary per filled region, which
      // turns a ring into a solid hexagon: the outside is traced, the inside is
      // not. So the background is flooded from the border first, and any
      // background left unreached is enclosed — a hole — and gets traced on the
      // same footing as the ink. With fill-rule="evenodd" the holes then punch
      // through, which is what makes a ring a ring.
      const outside = new Uint8Array(W * H);
      const edge: number[] = [];
      for (let x = 0; x < W; x++) { edge.push(x, (H - 1) * W + x); }
      for (let y = 0; y < H; y++) { edge.push(y * W, y * W + W - 1); }
      for (const e of edge) if (!mask[e] && !outside[e]) { outside[e] = 1; }
      const flood = edge.filter((e) => !mask[e]);
      while (flood.length) {
        const q = flood.pop()!;
        const qx = q % W, qy = (q / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = qx + dx!, ny = qy + dy!;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (!mask[n] && !outside[n]) { outside[n] = 1; flood.push(n); }
        }
      }
      // The holes, as a set of their own. Walking them on a mask that also
      // contains the ink lets the boundary walk wander out of the hole and
      // around the outside of the whole mark, which is how the first attempt
      // produced three loops and no rings.
      const holes = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) holes[i] = !mask[i] && !outside[i] ? 1 : 0;

      const seen = new Uint8Array(W * H);
      const loops: number[][][] = [];
      const OFF = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

      for (const pass of [mask, holes]) {
      for (let sy = 0; sy < H; sy++) {
        for (let sx = 0; sx < W; sx++) {
          const at = sy * W + sx;
          if (!pass[at] || seen[at]) continue;

          // Flood the region so it is walked once, and record its boundary by
          // walking the outline from this first pixel.
          const stack = [at];
          seen[at] = 1;
          const region: number[] = [];
          while (stack.length) {
            const q = stack.pop()!;
            region.push(q);
            const qx = q % W, qy = (q / W) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = qx + dx!, ny = qy + dy!;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const n = ny * W + nx;
              if (pass[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
            }
          }
          if (region.length < 400) continue;

          // Walk the outline clockwise from the top-left pixel of the region.
          let start = region[0]!;
          for (const q of region) if (q < start) start = q;
          const loop: number[][] = [];
          let cur = start, dir = 0, guard = 0;
          do {
            const cxp = cur % W, cyp = (cur / W) | 0;
            loop.push([cxp, cyp]);
            let moved = false;
            for (let k = 0; k < 8; k++) {
              const t = (dir + 6 + k) % 8;
              const o = OFF[t]!;
              const nx = cxp + o[0]!, ny = cyp + o[1]!;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              if (!pass[ny * W + nx]) continue;
              cur = ny * W + nx; dir = t; moved = true; break;
            }
            if (!moved) break;
          } while (cur !== start && ++guard < W * H);
          if (loop.length > 20) loops.push(loop);
        }
      }
      seen.fill(0);
      }

      // Douglas-Peucker, iterative so it does not recurse thousands deep.
      const simplified: number[][][] = [];
      for (const loop of loops) {
        const keep = new Uint8Array(loop.length);
        keep[0] = 1; keep[loop.length - 1] = 1;
        const work: [number, number][] = [[0, loop.length - 1]];
        while (work.length) {
          const [a, b] = work.pop()!;
          if (b <= a + 1) continue;
          const pa = loop[a]!, pb = loop[b]!;
          const dx = pb[0]! - pa[0]!, dy = pb[1]! - pa[1]!;
          const len = Math.hypot(dx, dy) || 1;
          let worst = -1, worstAt = -1;
          for (let i = a + 1; i < b; i++) {
            const p = loop[i]!;
            const dist = Math.abs(dy * (p[0]! - pa[0]!) - dx * (p[1]! - pa[1]!)) / len;
            if (dist > worst) { worst = dist; worstAt = i; }
          }
          if (worst > tolerance) { keep[worstAt] = 1; work.push([a, worstAt], [worstAt, b]); }
        }
        const out: number[][] = [];
        for (let i = 0; i < loop.length; i++) if (keep[i]) out.push(loop[i]!);
        simplified.push(out);
      }
      return { W, H, loops: simplified };
    },
    { data: Array.from(shot), tolerance: TOLERANCE },
  );

  // Normalise to a 100-wide box around the mark itself, so the component can be
  // placed by size rather than by guessing where in the artboard it sits.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const loop of traced.loops) {
    for (const [x, y] of loop) {
      if (x! < x0) x0 = x!; if (x! > x1) x1 = x!;
      if (y! < y0) y0 = y!; if (y! > y1) y1 = y!;
    }
  }
  const scale = 100 / (x1 - x0);
  const height = Number((((y1 - y0) * scale)).toFixed(2));

  const d = traced.loops
    .map((loop) =>
      loop
        .map(([x, y], i) => {
          const nx = ((x! - x0) * scale).toFixed(2);
          const ny = ((y! - y0) * scale).toFixed(2);
          return `${i === 0 ? "M" : "L"}${nx} ${ny}`;
        })
        .join("") + "Z",
    )
    .join("");

  console.log(`${traced.loops.length} loops, ${traced.loops.map((l) => l.length).join("+")} points`);
  console.log(`box 100 x ${height}, path ${d.length} chars`);
  writeFileSync("/tmp/mark-path.json", JSON.stringify({ d, height }, null, 1));
  await browser.close();
}
void main();
