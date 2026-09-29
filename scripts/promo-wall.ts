// The whole set in one picture, for posting.
//
//   npm run dev                    (in another terminal — it serves the renders)
//   npx tsx scripts/promo-wall.ts [out.png] [width] [height] [scale]
//   npx tsx scripts/promo-wall.ts cronus.png --family cronus
//   npx tsx scripts/promo-wall.ts --all            every project, into promo/
//   npx tsx scripts/promo-wall.ts --all --square   the same, 1600x1600
//   npx tsx scripts/promo-wall.ts lions.png --board lions
//
// Defaults to 1600x900 at 2x, which is the shape X gives the most room to and
// twice the pixels, so it stays sharp instead of being upscaled by the browser.
//
// ── IT USES THE FILES, NOT A SECOND DRAWING ──────────────────────────────────
//
// Every card here is public/render/<id>.webp, the same picture the NFT uses and
// the same one the close-up on /cards hands out. Four hundred and forty-eight of
// them at once is the one thing this project has that no screenshot can show,
// and drawing them again for a banner would be the third implementation of what
// a card looks like.
//
// ── WHAT IS IN FRONT ─────────────────────────────────────────────────────────
//
// By default the homepage's SHOWCASE, imported rather than listed again, for the
// reason scripts/banner.ts gives: a second list is a second answer to "which
// cards are the face of this", and the two disagree within a week.
//
// `--family <project>` fans one project's cards instead, in set order, which is
// rarity order — so a family reads left to right from common to whatever it tops
// out at. That is the picture to send a project whose cards are in this game.
//
// The fan sizes itself to the number of cards. Five and eight are different
// pictures, and a width that was right for one crops the other: the eight-card
// families ran off the right edge until this measured instead of assuming.
//
// The wall behind them is every card in set order, which is the honest answer to
// "how many are there" — it is not a flattering selection, it is all of it.

import { mkdirSync, statSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";
import sharp from "sharp";

import { BOARDS, boardOf, type Board } from "@/data/boards";
import { CONTRACTS } from "@/lib/revenue";
import { asWord } from "@/lib/publisher";
import { selector } from "@/lib/evm-tx";
import { SET } from "@/lib/set";
import { SHOWCASE } from "../app/page";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? null : (args[at + 1] ?? null);
};
const plain = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

/** 1600x1600 rather than 1600x900, for the places that crop a wide one. */
const SQUARE = args.includes("--square");

const OUT = plain[0] ?? (SQUARE ? "promo-square.png" : "promo-wall.png");
const W = Number(plain[1] ?? 1600);
const H = Number(plain[2] ?? (SQUARE ? 1600 : 900));
const SCALE = Number(plain[3] ?? 2);
const SITE = "http://localhost:3000";

/** One project's cards in front, or the homepage's five. */
const FAMILY = flag("family");
/** Every project, one picture each, into promo/. */
const ALL = args.includes("--all");
/** One board: its opponent's cards, and what it costs and pays. */
const BOARD = flag("board");
/**
 * Named cards, comma separated, for a picture about those and nothing else.
 *
 * --family draws everything a project has, which is the right answer for
 * introducing a project and the wrong one for showing three cards somebody
 * wants to talk about. Ids rather than names, because two cards may share a
 * name and an id never does — and an id that is not in the set throws here
 * rather than rendering a gap nobody notices until it is posted.
 */
const CARDS = flag("cards");

/**
 * Which project a card belongs to, or none.
 *
 * Narrowed rather than asserted: a tactic has no project, so `card.project` is
 * a type error on a third of the set and `as any` would have hidden the day a
 * tactic slipped into a family fan.
 */
const projectOf = (card: (typeof SET)[number]): string | null =>
  "project" in card && typeof card.project === "string" ? card.project : null;

/** Every project in the set, in the order the cards are in. */
const PROJECTS = [...new Set(SET.map(projectOf).filter((p): p is string => p !== null))];

const ORDER = ["common", "rare", "epic", "legendary", "mythic"];

interface Subject {
  /** The card ids in the fan, in set order, which is rarity order. */
  front: string[];
  /** What the family is called, as it is printed on the cards, or null. */
  name: string | null;
  /** Lowest to highest rarity in the fan, which is what a family shows off. */
  span: string;
  /**
   * A board, when the picture is about a board rather than a family.
   *
   * The same cards either way — a board's opponent IS its family — and a
   * different set of words. A family picture says "these exist"; a board
   * picture says what it costs to sit down opposite them and what is in the pot,
   * which are the two questions somebody deciding has.
   */
  /** The card names, when the picture is about named cards rather than a family. */
  cards?: string[];
  board?: {
    name: string;
    cro: number;
    /** Read off the chain, so the numbers on the picture are the ones on the site. */
    pot: string;
    lion: string;
  };
}

function subjectOf(family: string | null): Subject {
  const front =
    family === null ? [...SHOWCASE] : SET.filter((c) => projectOf(c) === family).map((c) => c.id);
  if (front.length === 0) {
    throw new Error(`No cards with project "${family}". There are: ${PROJECTS.join(", ")}`);
  }

  const rarities = front
    .map((id) => SET.find((c) => c.id === id)!.rarity)
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

  return {
    front,
    name: family === null ? null : SET.find((c) => projectOf(c) === family)!.name.toUpperCase(),
    span: `${rarities[0]!.toUpperCase()} TO ${rarities[rarities.length - 1]!.toUpperCase()}`,
  };
}

/** A picture about particular cards, named by id. */
function subjectOfCards(ids: string[]): Subject {
  for (const id of ids) {
    if (!SET.some((c) => c.id === id)) throw new Error(`There is no card "${id}" in the set.`);
  }
  // Kept in the order they were asked for. The fan leans outwards from the
  // middle, so which card sits in the centre is a choice somebody is making by
  // the order they typed.
  const rarities = ids
    .map((id) => SET.find((c) => c.id === id)!.rarity)
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return {
    front: ids,
    // Null, so the eyebrow and the count describe the set rather than these
    // three. Three cards out of four hundred is context somebody needs.
    name: null,
    span: `${rarities[0]!.toUpperCase()} TO ${rarities[rarities.length - 1]!.toUpperCase()}`,
    cards: ids.map((id) => SET.find((c) => c.id === id)!.name),
  };
}

/** The card's own proportions, from the render: 1072 x 1676. */
const RATIO = 1676 / 1072;

/**
 * Beside the words, or under them.
 *
 * Read off the shape rather than off the --square flag, so any size somebody
 * asks for lands on the layout that suits it. A column of text down the left
 * with a fan beside it needs a frame wider than it is tall; at 1:1 it leaves the
 * words in a gutter and the cards too small to see.
 */
const STACKED = W / H < 1.3;

/**
 * Everything typographic is a multiple of this.
 *
 * The sizes were written in pixels against a 1600-wide frame, which made them
 * right at exactly one size. Asked for 1200x630 — what a link preview is — the
 * same numbers came out half again too big: the headline filled the column, the
 * count line wrapped mid-phrase and the paragraph ran to four lines. A frame
 * twice as wide should get twice the type, not the same type with less room.
 */
const K = W / 1600;
const px = (n: number) => Math.round(n * K);

/**
 * How much of the frame the words take when they are beside the fan.
 *
 * A share of the width rather than a fixed 520. At 1600 the two are the same
 * number; at 1200 — the size a link preview is — a fixed column took forty-three
 * per cent of the frame and squeezed the cards down to nothing.
 */
const SAY_WIDTH = STACKED ? W - 160 : Math.round(W * 0.33);

/**
 * A headline size that fits the name it was given.
 *
 * Ninety-two points suits CRONUS and puts FORTUNE FAVOURS THE BRAVE CARDS out
 * of the frame and over the fan. Forty-three projects is too many to eyeball one
 * at a time, so it is measured: wrap greedily at the width the column has, and
 * shrink until the estimate says three lines or fewer.
 *
 * THE ESTIMATE IS OPTIMISTIC, DELIBERATELY. Archivo Black is reckoned at 0.62em
 * to the character in caps, which is narrower than it really is, so the browser
 * breaks a line or two more than this predicts — FORTUNE FAVOURS THE BRAVE lands
 * on five. That is the direction to be wrong in: an extra line is a taller stack
 * of words in a column that has the room, and the thing to avoid is a headline
 * too wide for the column, which this cannot produce.
 */
function headline(words: string[], oneEach = false): { size: number; html: string } {
  // A list of names is not a sentence. Packing "PAMPA FRANCIS 21MILLION" onto
  // one line reads as a single long name, which is the opposite of what a
  // picture naming three cards is for.
  if (oneEach) {
    const longest = Math.max(...words.map((one) => one.length));
    const size = Math.max(px(44), Math.min(px(92), Math.floor(SAY_WIDTH / (longest * 0.62))));
    return { size, html: words.join("<br>") };
  }
  for (let size = px(92); size >= px(44); size -= Math.max(2, px(4))) {
    const perLine = Math.floor(SAY_WIDTH / (size * 0.62));
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line === "" ? word : `${line} ${word}`;
      if (next.length <= perLine || line === "") line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line !== "") lines.push(line);
    // Three lines at the largest size that gives three. Any word too long for
    // its own line is accepted rather than looped on forever.
    if (lines.length <= 3 || size <= px(44)) return { size, html: lines.join("<br>") };
  }
  return { size: px(44), html: words.join("<br>") };
}

function page({ front, name, span, board, cards }: Subject): string {
  const title = headline(
    board !== undefined
      ? ["BEAT", "THE", ...board.name.split(/\s+/).slice(-1)]
      : cards !== undefined
        // The names, and nothing else. A headline reading CARDS OF CRONOS over
        // three named cards wastes the one line that could say who they are.
        ? cards.map((one) => one.toUpperCase())
        : name === null
          ? ["CARDS", "OF", "CRONOS"]
          : [...name.split(/\s+/), "CARDS"],
    cards !== undefined,
  );

  // The set for the general picture, the family for a family one. Folding the
  // two into one line made this front.length for both, so the picture for the
  // whole game announced "5 CARDS" — the size of its own fan.
  const counts = name === null ? SET.length : front.length;

  /** What the board costs and pays, as the two lines under the headline. */
  const money =
    board === undefined
      ? null
      : {
          // The pot first. It is the reason to look, and it is the number that
          // grows — leading with the fee leads with the reason not to.
          big: `${board.pot} $CROCARD`,
          small: `+ ${board.lion} $LION in the pot · ${board.cro} CRO a go`,
        };

  const blurb =
    cards !== undefined
      ? `${cards.slice(0, -1).join(", ")} and ${cards[cards.length - 1]} are in the game. ` +
        `${SET.length} cards on Cronos, ten turns, and the highest market cap wins.`
      : board !== undefined
      ? `Their whole family, and a deck built to hold them. Beat it and your best market cap of ` +
        `the week takes the pot. Half of every entry buys $LION straight into it.`
      : name === null
      ? "A trading card game on Cronos. Ten turns, a marketing budget that grows, and the highest market cap wins."
      : `${name} is in the game. ${SET.length} cards on Cronos, ten turns, and the highest market cap wins.`;

  const wall = SET.map(
    (card) =>
      `<img src="${SITE}/render/${card.id}.webp" loading="eager" decoding="sync" alt="">`,
  ).join("");

  // Measured rather than assumed. The words take the left, the fan takes what is
  // left over, and the cards shrink to fit it — eight at the width five wanted
  // put the last one through the right edge.
  // A fan of n cards overlapping by a fraction f of their width is not n cards
  // wide. It is cardW * (n - (n-1)*f). Guessing at that put a fan of eight over
  // the top of the words, which on a picture whose whole job is to be read at a
  // glance is the one thing it cannot do.
  // Stacked, the cards overlap more. Not for looks: a square frame gives the fan
  // the whole width and about half the height, so at the wide layout's spacing
  // the cards came out small with six hundred empty pixels above and below them.
  // Overlapping further buys width back as size, and a third of a card covered
  // still shows the art, which sits at the top of the face.
  // How far the cards sit over each other, and how large they may be, both
  // depend on how many there are. Eight cards need the compression or the fan
  // runs off the frame; three do not, and at the eight-card spacing they cover
  // each other's text for no reason — which on a picture whose subject IS those
  // three cards is the whole picture wasted.
  const few = front.length <= 4;
  const OVERLAP = few ? 0.16 : STACKED ? 0.34 : 0.26;
  const room = STACKED ? W - 80 : W - SAY_WIDTH - 150;
  const spans = front.length - (front.length - 1) * OVERLAP;
  const cardW = Math.min(few ? 430 : STACKED ? 300 : 200, Math.floor(room / spans));
  const overlap = Math.round(cardW * OVERLAP);

  const heroes = front.map((id, i) => {
    // A fan: the middle card upright and the others leaning away from it, each
    // one a little lower, the way a hand of cards actually sits.
    const middle = (front.length - 1) / 2;
    const off = i - middle;
    // Six degrees a step, not seven. At seven the outer card's corner swung
    // past the right edge of the frame and was cut in half — which on a fan of
    // five is the one card that looks like a mistake rather than a crop.
    const tilt = off * (front.length > 6 ? 4.5 : 6);
    const drop = Math.abs(off) * (cardW * 0.15);
    return `<img class="hero" style="
      width: ${cardW}px;
      transform: rotate(${tilt}deg) translateY(${drop}px);
      z-index: ${front.length - Math.abs(off)};
      margin-left: ${i === 0 ? 0 : -overlap}px;
    " src="${SITE}/render/${id}.webp" alt="">`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
    background: #050314;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }

  /* ── THE WALL ──────────────────────────────────────────────────────────
     Every card, tilted and oversized so it runs off all four edges. A grid
     that stopped at the frame would read as a screenshot of a page; one that
     is cut off reads as "there is more of this". */
  .wall {
    position: absolute; inset: -22%;
    display: grid;
    grid-template-columns: repeat(32, 1fr);
    gap: 5px;
    transform: rotate(-9deg) scale(1.08);
    transform-origin: center;
  }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  /* Dimmed towards the left, where the words go, and lifted on the right so
     the fan has something to sit against. Two layers rather than one: a flat
     scrim over four hundred cards kills them, and a gradient alone does not
     get dark enough to read white text over. */
  .scrim {
    position: absolute; inset: 0;
    background: ${
      STACKED
        ? // Top and bottom, where the words sit, and lightest across the middle
          // where the fan is. The wide one darkens the left instead — a gradient
          // aimed at a gutter that this layout does not have.
          `linear-gradient(180deg, #050314 12%, rgba(5,3,20,0.9) 30%, rgba(5,3,20,0.5) 50%, rgba(5,3,20,0.9) 72%, #050314 92%),
           radial-gradient(90% 60% at 50% 50%, rgba(5,3,20,0) 0%, rgba(5,3,20,0.7) 100%)`
        : `linear-gradient(100deg, #050314 26%, rgba(5,3,20,0.86) 46%, rgba(5,3,20,0.55) 70%, rgba(5,3,20,0.72) 100%),
           radial-gradient(120% 90% at 18% 50%, rgba(5,3,20,0.92) 0%, rgba(5,3,20,0) 60%)`
    };
  }
  /* A purple wash, because the palette is purple and four hundred card frames
     in every colour average out to grey. */
  .tint {
    position: absolute; inset: 0; mix-blend-mode: soft-light;
    background: radial-gradient(90% 120% at ${STACKED ? "50% 50%" : "78% 40%"}, #9d4edd 0%, rgba(157,78,221,0) 62%);
  }

  /* ── THE FAN ───────────────────────────────────────────────────────────── */
  .fan {
    position: absolute;
    ${
      STACKED
        ? // Forty-seven, not fifty. The outer cards are pushed downwards to make
          // the fan, so its visual middle sits below its box — centring the box
          // left more air above the cards than below them.
          "left: 50%; top: 47%; transform: translate(-50%, -50%) rotate(-2deg);"
        : `right: ${px(95)}px; top: 50%; transform: translateY(-50%) rotate(-3deg);`
    }
    display: flex; align-items: center;
  }
  .hero {
    aspect-ratio: 1072 / 1676;
    border-radius: ${px(10)}px;
    box-shadow: 0 28px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(157,78,221,0.35);
  }

  /* ── THE WORDS ─────────────────────────────────────────────────────────── */
  .say {
    position: absolute; width: ${SAY_WIDTH}px;
    ${STACKED ? `left: ${px(80)}px; top: ${px(88)}px; text-align: center;` : `left: ${px(64)}px; top: 50%; transform: translateY(-50%);`}
  }
  /* Stacked, the closing lines go under the fan rather than under the title —
     otherwise the whole block sits above the cards and the bottom third is a
     dimmed wall with nothing on it. */
  .foot {
    position: absolute; left: ${px(80)}px; bottom: ${px(92)}px; width: ${SAY_WIDTH}px; text-align: center;
  }
  .eyebrow {
    font-size: ${px(15)}px; letter-spacing: 0.34em; color: #ffd700; font-weight: 700;
  }
  h1 {
    font-family: "Archivo Black", sans-serif;
    font-size: ${title.size}px; line-height: 0.94; color: #fff; margin-top: ${px(16)}px;
    letter-spacing: -0.015em;
  }
  .count {
    font-family: "Archivo Black", sans-serif;
    font-size: ${px(38)}px; color: #ffd700; margin-top: ${px(22)}px; letter-spacing: 0.01em;
  }
  /* Its own line, not trailing the number. Inline it wrapped mid-phrase out of
     the column and into the fan — and the longer the pot grows, the worse. */
  .count span {
    display: block; margin-top: ${px(8)}px;
    color: #9d93b8; font-size: ${px(20)}px; font-family: "JetBrains Mono", monospace;
  }
  p.line {
    font-size: ${px(18)}px; line-height: 1.6; color: #9d93b8; margin-top: ${px(18)}px;
    ${STACKED ? `max-width: ${px(720)}px; margin-left: auto; margin-right: auto;` : `max-width: ${SAY_WIDTH}px;`}
  }
  .url {
    margin-top: ${px(30)}px; font-size: ${px(17)}px; letter-spacing: 0.22em; color: #00e08a; font-weight: 700;
  }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="fan">${heroes}</div>
  <div class="say">
    <div class="eyebrow">${
      board !== undefined
        ? "CARDS OF CRONOS · WEEKLY"
        : name === null
          ? "SET 01 · CRONOS"
          : "CARDS OF CRONOS · SET 01"
    }</div>
    <h1>${title.html}</h1>
    ${
      // Left out when the headline is a list of names. Three names take three
      // lines, and the count line underneath them landed on top of the fan —
      // and it is saying what the sentence at the foot already says.
      cards !== undefined
        ? ""
        : `<div class="count">${money !== null ? money.big : `${counts} CARDS`}<span>${
            money !== null ? money.small : `· ${name === null ? "5,603 minted at most" : span}`
          }</span></div>`
    }
    ${STACKED ? "" : `<p class="line">${blurb}</p><div class="url">CARDSOFCRONOS.COM</div>`}
  </div>
  ${STACKED ? `<div class="foot"><p class="line">${blurb}</p><div class="url">CARDSOFCRONOS.COM</div></div>` : ""}
</body></html>`;
}

/** One picture, written where it was asked for. Returns what it weighs. */
async function shoot(
  tab: import("playwright").Page,
  subject: Subject,
  out: string,
  alsoPng: boolean,
): Promise<number> {
  await tab.setContent(page(subject), { waitUntil: "load" });
  // Every card decoded before the shutter. `load` fires when the requests are
  // done, which is not the same as the pixels being on screen — and a wall with
  // forty holes in it is the shape this would fail in.
  await tab.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
    );
  });
  await tab.waitForTimeout(alsoPng ? 600 : 250);

  const png = await tab.screenshot({ type: "png" });
  // Asked for a .jpg, you get a .jpg and nothing else. Writing the PNG beside it
  // regardless is how `npm run promo-og` would leave both app/opengraph-image.png
  // and .jpg in place — two files matching one Next.js file convention, with
  // nothing saying which one a scraper is going to be handed.
  if (alsoPng && !/\.jpe?g$/i.test(out)) writeFileSync(out.replace(/\.png$/i, ".png"), png);

  // JPEG is the one to post: X refuses a PNG over five megabytes and a wall of
  // four hundred pictures lands at four point nine. Quality 92 puts the same
  // image at about a fifth of that, and nothing here is a flat colour or a hard
  // gradient — the two things JPEG actually spoils.
  const jpg = out.replace(/\.png$/i, ".jpg");
  await sharp(png).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(jpg);
  return statSync(jpg).size;
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * What a board costs and what is in its pots, read off Cronos.
 *
 * Off the chain rather than out of a file, because these are the numbers on the
 * site and a picture quoting a different one is worse than a picture quoting
 * none. They move — the $LION pot grows every time anybody plays — so the
 * answer is fetched the moment the picture is made.
 */
async function moneyOf(board: Board): Promise<Subject["board"]> {
  const call = async (to: string, data: string) => {
    const answer = await fetch("https://evm.cronos.org", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    });
    const body = (await answer.json()) as { result?: string; error?: { message: string } };
    if (body.error) throw new Error(body.error.message);
    return BigInt(body.result ?? "0x0");
  };
  const whole = (n: bigint) => (n / 10n ** 18n).toLocaleString("en-US");

  const pot = CONTRACTS.pot;
  const share = pot === null ? 0n : await call(pot, selector("nextPrize(bytes32)") + asWord(board.id));

  const own = board.alsoPays?.contract ?? null;
  const lion =
    own === null || board.alsoPays === null
      ? 0n
      : await call(
          board.alsoPays.token,
          selector("balanceOf(address)") + own.replace(/^0x/, "").toLowerCase().padStart(64, "0"),
        );

  return {
    name: board.name,
    cro: board.entry?.cro ?? 0,
    pot: whole(share),
    lion: whole(lion),
  };
}

async function main() {
  const browser = await chromium.launch();
  const tab = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });

  if (ALL) {
    // One browser and one tab for all of them. The wall is four hundred and
    // forty-eight requests; served once, the rest come out of the browser's own
    // cache, which is the difference between twenty minutes and two.
    // Two shapes, two folders. One folder with both in it means picking the
    // right file by reading the name, forty-three times.
    const dir = STACKED ? "promo-square" : "promo";
    mkdirSync(dir, { recursive: true });
    let total = 0;
    for (const [i, family] of PROJECTS.entries()) {
      const subject = subjectOf(family);
      const out = `${dir}/${family}-cards.jpg`;
      const size = await shoot(tab, subject, out, false);
      total += size;
      console.error(
        `  ${String(i + 1).padStart(2)}/${PROJECTS.length}  ${out.padEnd(34)} ${mb(size)}  ${subject.name}`,
      );
    }
    await browser.close();
    console.log(`\n  ${PROJECTS.length} pictures in ${dir}/, ${mb(total)} in all\n`);
    return;
  }

  let subject: Subject;
  if (BOARD !== null) {
    const board = boardOf(BOARD);
    if (board === undefined) {
      throw new Error(`No board "${BOARD}". There are: ${BOARDS.map((b) => b.id).join(", ")}`);
    }
    // A board's opponent IS a family, so the fan is the same cards a
    // --family run would draw. Taken off the board rather than named again,
    // so the picture cannot show a deck the board does not field.
    if (board.opponent.kind !== "family") {
      throw new Error(`Board "${board.id}" fields a generated deck, so there is no family to show.`);
    }
    subject = { ...subjectOf(board.opponent.family), board: await moneyOf(board) };
  } else {
    subject = CARDS === null
      ? subjectOf(FAMILY)
      : subjectOfCards(CARDS.split(",").map((one) => one.trim()).filter(Boolean));
  }
  const size = await shoot(tab, subject, OUT, true);
  await browser.close();

  console.log(
    `\n  ${OUT}  ${W * SCALE}x${H * SCALE}  ·  ${SET.length} in the wall` +
      `, ${subject.front.length} in front${subject.name === null ? "" : ` (${subject.name})`}`,
  );
  console.log(`  ${OUT.replace(/\.png$/i, ".jpg")}  ${mb(size)}  — this is the one to post\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
