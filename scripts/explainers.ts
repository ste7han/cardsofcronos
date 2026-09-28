// One mechanic, one square picture. A series, to post one at a time.
//
//   npx tsx scripts/explainers.ts            # every one, into promo-how/
//   npx tsx scripts/explainers.ts merge      # just that one
//   npx tsx scripts/explainers.ts --list
//
// ── THE NUMBERS ARE DERIVED, NEVER TYPED ─────────────────────────────────────
//
// Every figure on these comes out of RULES, MARKETING_COST and TURN_ACTION_COST,
// so a rebalance moves the pictures with it and cannot leave them describing a
// game that no longer exists. This project has eight card images still showing
// figures the data does not have any more, from exactly that mistake, and a
// picture explaining a rule is worse to get wrong than a card: somebody reads it
// once and believes it.
//
// The prose still has to be checked by a person against engine/types.ts. What is
// mechanised here is only the part a machine can be right about.
//
// The wall behind them is the one the other promos use — every card in the set,
// tilted, running off all four edges.

import { mkdirSync, writeFileSync } from "node:fs";

import { chromium, type Page } from "playwright";
import sharp from "sharp";

import { MARKETING_COST, RULES, TURN_ACTION_COST } from "@/engine/types";
import { formatMC } from "@/engine/format";
import { SET } from "@/lib/set";

const args = process.argv.slice(2);
const W = 1600;
const SCALE = 2;
const SITE = "http://localhost:3000";
const DIR = "promo-how";

const mc = (n: number) => formatMC(n);

/**
 * A small number as the word for it, for use in a sentence.
 *
 * The figures on these pictures are derived so a rebalance cannot leave them
 * lying, and that has to hold inside the prose too — but "But 6 positions each
 * take their own damage" reads like a form rather than a sentence. So the value
 * still comes from RULES and only its spelling changes here.
 */
const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
];
const word = (n: number) => WORDS[n] ?? String(n);

interface Explainer {
  id: string;
  /** The line at the top. Two or three words. */
  kicker: string;
  /** The headline. Short enough to set at 100px and still fit two lines. */
  title: string;
  /** The explanation. Two or three sentences, in the game's own voice. */
  body: string;
  /** Three figures at most, each a label and a value. Computed, not written. */
  facts: { label: string; value: string }[];
}

/**
 * The series, in the order somebody meeting the game should read it.
 *
 * Each one is a rule that decides a match rather than a piece of flavour, and
 * each is checked against engine/types.ts — the comments there are where these
 * sentences come from.
 */
const EXPLAINERS: Explainer[] = [
  {
    id: "turns",
    kicker: "YOUR BUDGET",
    title: "THE BUDGET\nGROWS EVERY\nTURN",
    body:
      `Every turn you get money to play cards with. Turn 1 gives you ${mc(RULES.budgetPerTurn)}. Turn ${RULES.turns} gives ` +
      `you ${mc(RULES.budgetPerTurn * RULES.turns)}. You cannot save it: anything you do not spend is taken off your market ` +
      `cap when the turn ends. So the expensive cards are simply out of reach early on.`,
    facts: [
      { label: "TURNS", value: String(RULES.turns) },
      { label: "TURN 1", value: mc(RULES.budgetPerTurn) },
      { label: `TURN ${RULES.turns}`, value: mc(RULES.budgetPerTurn * RULES.turns) },
    ],
  },
  {
    id: "marketcap",
    kicker: "HOW YOU WIN",
    title: "HIGHEST\nMARKET CAP\nWINS",
    body:
      `After ${RULES.turns} turns, the bigger market cap takes it. When you play a project it pays you once. ` +
      `Then it pays you again every turn you leave it on the board. A project you played early ` +
      `keeps earning for the rest of the match.`,
    facts: [
      { label: "TURNS", value: String(RULES.turns) },
      { label: "PROJECTS", value: String(RULES.portfolioSize) },
      { label: "CARDS IN HAND", value: String(RULES.handSize) },
    ],
  },
  {
    id: "take-profit",
    kicker: "THE BIG DECISION",
    title: "TAKE PROFIT,\nOR KEEP\nBUILDING",
    body:
      `Close a project and you keep everything it has earned. Nobody can rug it after that. ` +
      `But closing it uses one of your plays for the turn. So near the end of a match you have ` +
      `to choose: play another card, or lock in what you already have.`,
    facts: [
      { label: "COSTS", value: mc(TURN_ACTION_COST) },
      { label: "USES", value: "ONE PLAY" },
      { label: "SAFE FROM", value: "RUGS" },
    ],
  },
  {
    id: "merge",
    kicker: "ONE CARD, YOUR WHOLE BOARD",
    title: "MERGE IT\nALL INTO\nONE PROJECT",
    body:
      `A merge card closes all your other projects and moves what they earned onto the one you ` +
      `just played. You keep every dollar, because you closed them yourself. The risk is what ` +
      `comes after: ${RULES.portfolioSize} projects each take damage on their own, but one project takes all of it.`,
    facts: [
      { label: "CLOSES", value: `UP TO ${RULES.portfolioSize - 1}` },
      { label: "YOU KEEP", value: "EVERYTHING" },
      { label: "RISK", value: "ONE TARGET" },
    ],
  },
  {
    id: "portfolio",
    kicker: "BOARD SPACE",
    title: `YOU CAN HOLD\n${word(RULES.portfolioSize).toUpperCase()} PROJECTS\nAT A TIME`,
    body:
      `A full board does not stop you playing. You close one project to make room, and you keep ` +
      `everything it has earned so far. All you give up is what it would have earned later. ` +
      `The limit is also what makes attacks hurt: losing one project of ${RULES.portfolioSize} is a real loss.`,
    facts: [
      { label: "PROJECTS", value: String(RULES.portfolioSize) },
      { label: "SWAP COSTS", value: mc(TURN_ACTION_COST) },
      { label: "YOU KEEP", value: "WHAT IT MADE" },
    ],
  },
  {
    id: "deck",
    kicker: "BEFORE THE MATCH",
    title: `${word(RULES.deckSize).toUpperCase()} CARDS,\nAND YOU WILL SEE\nMOST OF THEM`,
    body:
      `You build a deck of ${RULES.deckSize} cards. Every card costs points and your deck has a points limit, ` +
      `so you cannot simply fill it with the best ones. You draw about 31 cards in a match, ` +
      `which means what you build is very close to what you get.`,
    facts: [
      { label: "DECK", value: String(RULES.deckSize) },
      { label: "CHEAPEST CARD", value: mc(MARKETING_COST.common) },
      { label: "MYTHIC CARD", value: mc(MARKETING_COST.mythic) },
    ],
  },
];

function page(one: Explainer, n: number, of: number): string {
  const wall = SET.map(
    (card) => `<img src="${SITE}/render/${card.id}.webp" loading="eager" decoding="sync" alt="">`,
  ).join("");

  const facts = one.facts
    .map(
      (fact) =>
        `<div class="fact"><div class="flabel">${fact.label}</div><div class="fvalue">${fact.value}</div></div>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${W}px; overflow: hidden; position: relative;
         background: #050314; font-family: "JetBrains Mono", ui-monospace, monospace; }

  .wall { position: absolute; inset: -22%; display: grid;
          grid-template-columns: repeat(32, 1fr); gap: 5px;
          transform: rotate(-9deg) scale(1.08); transform-origin: center; }
  .wall img { width: 100%; aspect-ratio: 1072 / 1676; object-fit: cover; border-radius: 3px; }

  /* Darkest on the left, where the words are, and left alone on the right so the
     cards stay the background rather than becoming a texture. */
  .scrim { position: absolute; inset: 0; background:
    linear-gradient(96deg, rgba(5,3,20,0.96) 0%, rgba(5,3,20,0.92) 46%, rgba(5,3,20,0.55) 76%, rgba(5,3,20,0.72) 100%),
    linear-gradient(180deg, rgba(5,3,20,0.45) 0%, rgba(5,3,20,0) 26%, rgba(5,3,20,0.5) 100%); }
  .tint { position: absolute; inset: 0; mix-blend-mode: soft-light;
    background: radial-gradient(80% 90% at 78% 46%, #9d4edd 0%, rgba(157,78,221,0) 62%); }

  /* The block is centred and the footer is pinned.
     Spacing them apart instead left three hundred empty pixels under the facts
     on the shorter ones — a picture with a hole in it, where the hole moved
     depending on how long the sentence happened to be. */
  .sheet { position: absolute; inset: 0; padding: 112px 104px;
           display: flex; flex-direction: column; justify-content: center; }
  .foot { position: absolute; left: 104px; right: 104px; bottom: 96px; }

  .top { display: flex; align-items: baseline; justify-content: space-between; gap: 30px; }
  .kicker { font-size: 19px; letter-spacing: 0.38em; color: #ffd700; font-weight: 700; }
  .count { font-size: 17px; letter-spacing: 0.3em; color: #6f6390; font-weight: 700; }

  h1 { font-family: "Archivo Black", sans-serif; font-size: 108px; line-height: 0.92;
       color: #fff; letter-spacing: -0.022em; white-space: pre-line; margin-top: 54px;
       max-width: 1080px; }

  .body { margin-top: 42px; max-width: 900px; font-size: 28px; line-height: 1.58;
          color: #cdbfe4; }

  .facts { display: flex; gap: 22px; margin-top: 60px; }
  .fact { flex: 1; padding: 26px 28px; border: 1px solid rgba(157,78,221,0.42);
          background: rgba(8,5,26,0.82); border-radius: 4px; }
  .flabel { font-size: 14px; letter-spacing: 0.26em; color: #8a7cab; font-weight: 700; }
  .fvalue { font-family: "Archivo Black", sans-serif; font-size: 40px; color: #00e08a;
            margin-top: 12px; letter-spacing: -0.01em; white-space: nowrap; }

  .foot { display: flex; align-items: baseline; justify-content: space-between;
          font-size: 17px; letter-spacing: 0.3em; font-weight: 700; }
  .site { color: #00e08a; }
  .set { color: #6f6390; }

  .kicker, .count, h1, .body, .foot { text-shadow: 0 2px 20px rgba(5,3,20,0.9); }
</style></head><body>
  <div class="wall">${wall}</div>
  <div class="scrim"></div>
  <div class="tint"></div>
  <div class="sheet">
    <div>
      <div class="top">
        <div class="kicker">${one.kicker}</div>
        <div class="count">${String(n).padStart(2, "0")} / ${String(of).padStart(2, "0")}</div>
      </div>
      <h1>${one.title}</h1>
      <div class="body">${one.body}</div>
      <div class="facts">${facts}</div>
    </div>
    <div class="foot">
      <span class="site">CARDSOFCRONOS.COM</span>
      <span class="set">SET 01 · ${SET.length} CARDS</span>
    </div>
  </div>
</body></html>`;
}

async function shoot(tab: Page, one: Explainer, n: number, of: number): Promise<number> {
  await tab.setContent(page(one, n, of), { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: W } });
  writeFileSync(`${DIR}/${String(n).padStart(2, "0")}-${one.id}.png`, shot);
  const { size } = await sharp(shot)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(`${DIR}/${String(n).padStart(2, "0")}-${one.id}.jpg`);
  return size;
}

async function main() {
  if (args.includes("--list")) {
    for (const [i, one] of EXPLAINERS.entries()) {
      console.log(`  ${String(i + 1).padStart(2, "0")}  ${one.id.padEnd(14)} ${one.title.replace(/\n/g, " ")}`);
    }
    return;
  }

  const wanted = args.filter((a) => !a.startsWith("--"));
  const doing =
    wanted.length === 0 ? EXPLAINERS : EXPLAINERS.filter((one) => wanted.includes(one.id));
  if (doing.length === 0) {
    throw new Error(`No explainer called that. There are: ${EXPLAINERS.map((o) => o.id).join(", ")}`);
  }

  mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch();
  // One tab for all of them: the wall is 448 requests and the browser's own
  // cache is the difference between twenty minutes and two.
  const tab = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: SCALE });

  let total = 0;
  for (const one of doing) {
    const n = EXPLAINERS.indexOf(one) + 1;
    const size = await shoot(tab, one, n, EXPLAINERS.length);
    total += size;
    console.log(
      `  ${String(n).padStart(2, "0")}  ${`${DIR}/${String(n).padStart(2, "0")}-${one.id}.jpg`.padEnd(34)} ` +
        `${(size / 1024 / 1024).toFixed(2)} MB`,
    );
  }
  await browser.close();
  console.log(`\n  ${doing.length} in ${DIR}/, ${(total / 1024 / 1024).toFixed(2)} MB in all\n`);
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
