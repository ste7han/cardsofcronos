// Het lezen van één combat-logregel, los van React zodat het te testen is.
//
// De Python-engine logt proza, geen gestructureerde events. Een paar echte regels:
//
//   📈 Player 1's COC_Howlers_C2 starts with base MC → 7.0
//   ↳ 📈 COC_CF_Founder_C1 boosts Player 2's COC_DAK_E1 by +3.0 MC → 27.0 → 30.0
//   ↳ ➖ COC_Cr00ts_R1 reduces Player 2's COC_Clove_R2 by -3.0 MC → 17.0 → 14.0
//   ↳ 💥 COC_Zero_Day destroys COC_Clove_R2 (base 17.0 MC) → transfers to COC_Howlers_C2 → 17.0 → 34.0
//
// Let op de laatste: de vernietigde kaart staat na "destroys", terwijl de
// eindwaarde bij de kaart hoort die de MC ontvángt. Simpelweg "de laatste
// kaart op de regel" pakken gaat daar dus mis.

export type GlowType = 'acting' | 'buff' | 'debuff';

export interface ParsedLine {
  /** Welke kaart welke gloed krijgt. */
  glow: Record<string, GlowType>;
  /** Het zwevende +N / -N getal per kaart. */
  deltas: Record<string, number>;
  /** De exacte nieuwe MC per kaart, als de regel die noemt. */
  values: Record<string, number>;
  /** De kaart die vernietigd wordt, indien van toepassing. */
  destroyedId: string | null;
  /** Eigenaar per kaart, als de regel het expliciet zegt. */
  ownerOf: Record<string, string>;
}

// Twee kaart-id's bevatten een teken buiten \w: COC_EVT_Pump_&_Dump en
// COC_EVT_Ding_Ding_Ding!. Zonder die uitzondering knipt de regex de naam af,
// hoort de kaart bij geen enkel exemplaar op het bord, en blijft "_Dump" in de
// tekst staan — waardoor de opstellingsregel rood kleurde.
const CARD_PATTERN = String.raw`COC_\w+(?:&_\w+)*!?`;
const CARD_RE = new RegExp(CARD_PATTERN, 'g');
const OWNER_RE = new RegExp(String.raw`Player\s+([12])['’]s\s+(${CARD_PATTERN})`, 'g');
const DELTA_RE = new RegExp(String.raw`(${CARD_PATTERN})\s+by\s+([-+]?\d+(?:\.\d+)?)\s*MC`, 'g');
const ARROW_RE = /→\s*(-?\d+(?:\.\d+)?)/g;

// "⛔ … could not act — …" en "skipped": de kaart doet níéts, ook al staan de
// woorden van het effect wel op de regel.
const SKIP_LINE = /⛔|could not act|skipped|no valid targets/i;

// Een regel die alleen meldt dát een voorwaarde is getoetst, zonder gevolg.
const CONDITION_LINE = /→\s*[✅❌]/;

// Het werkwoord met de vernietigde kaart er direct achter, eventueel met
// "enemy"/"friendly"/"Player 2's" ertussen.
const DESTROY_RE = new RegExp(
  String.raw`destroy(?:s|ed)\s+(?:enemy\s+|friendly\s+|the\s+|its\s+|his\s+)?(?:Player\s+[12]['’]s\s+)?[\`'"]?(${CARD_PATTERN})`, 'i');
const DESTROY_SUMMARY_RE = new RegExp(String.raw`(${CARD_PATTERN})[^A-Za-z0-9]*(?:–|-|—)\s*destroyed`, 'i');
const TRANSFER_RE = new RegExp(String.raw`transfers?\s+to\s+(${CARD_PATTERN})`, 'i');

const DEBUFF_WORDS = /hit|damage|reduc|steal|stole|lost|lose|burn|drain|destro|rug|crash|dump/;
const BUFF_WORDS = /boost|buff|gain|heal|increase|pump|rise|transfer/;

const empty = (): ParsedLine => ({ glow: {}, deltas: {}, values: {}, destroyedId: null, ownerOf: {} });

export function parseBattleLine(log: string): ParsedLine {
  const out = empty();
  const ids = log.match(CARD_RE);
  if (!ids || ids.length === 0) return out;

  // Trefwoorden alleen op het proza toetsen, nooit op kaartnamen. Anders kleurt
  // COC_EVT_Rug_Pull rood zodra hij genoemd wordt ("rug"), en COC_Bear_Market
  // net zo — ook als de regel alleen de opstelling toont.
  const lower = log.replace(CARD_RE, ' ').toLowerCase();

  // 1. Eigenaar-hints. Beide spelers mogen dezelfde kaart spelen, dus zonder
  //    deze hint zouden we allebei de exemplaren aanpassen.
  for (const m of log.matchAll(OWNER_RE)) out.ownerOf[m[2]] = `Player ${m[1]}`;

  // 2. "Kon niet handelen"-regels noemen vaak wél de woorden van een effect
  //    ("No Nova Projects were destroyed"), terwijl er juist niets gebeurt.
  //    Zonder deze uitzondering kleurt zo'n regel een kaart ten onrechte rood.
  if (SKIP_LINE.test(log)) {
    out.glow[ids[0]] = 'acting';
    return out;
  }

  // 3. Vernietiging. "X destroys Y", "X destroyed Player 2's Y", "destroys enemy Y",
  //    of de samenvattingsregel "• Y – Destroyed". Een ontkenning ("was not
  //    destroyed", "2 card(s) destroyed") heeft geen kaart direct achter het
  //    werkwoord en valt daardoor vanzelf af.
  const destroyed = log.match(DESTROY_RE) || log.match(DESTROY_SUMMARY_RE);
  if (destroyed) out.destroyedId = destroyed[1];

  // 3. "… COC_X by +6.0 MC" — wie hoeveel wint of verliest.
  for (const m of log.matchAll(DELTA_RE)) {
    const value = parseFloat(m[2]);
    if (Number.isFinite(value) && value !== 0) out.deltas[m[1]] = value;
  }

  // 4. De eindwaarde achter de pijlen. Die hoort bij de kaart die de MC krijgt:
  //    bij een transfer is dat de ontvanger, anders de laatste kaart vóór de
  //    eerste pijl. De láátste pijl draagt de nieuwe waarde ("→ 17.0 → 14.0").
  const arrowIndex = log.indexOf('→');
  if (arrowIndex !== -1) {
    const transfer = log.match(TRANSFER_RE);
    let owner: string | null = transfer ? transfer[1] : null;
    if (!owner) {
      const before = log.slice(0, arrowIndex).match(CARD_RE);
      owner = before ? before[before.length - 1] : null;
    }
    if (owner) {
      const arrows = [...log.slice(arrowIndex).matchAll(ARROW_RE)];
      if (arrows.length) {
        const value = parseFloat(arrows[arrows.length - 1][1]);
        if (Number.isFinite(value)) out.values[owner] = value;
      }
    }
  }

  // 5. Gloed. Een bedrag is het betrouwbaarste signaal; daarna pas trefwoorden.
  for (const [id, value] of Object.entries(out.deltas)) {
    out.glow[id] = value > 0 ? 'buff' : 'debuff';
  }
  if (out.destroyedId) out.glow[out.destroyedId] = 'debuff';

  if (Object.keys(out.glow).length === 0) {
    const target = ids[ids.length - 1];
    if (CONDITION_LINE.test(log)) {
      // "COC_X any_card_destroyed → ✅" meldt alleen dat een voorwaarde is
      // getoetst. De woorden van het effect staan erin, de klap nog niet.
      out.glow[target] = 'acting';
    } else if (DEBUFF_WORDS.test(lower)) out.glow[target] = 'debuff';
    else if (BUFF_WORDS.test(lower)) out.glow[target] = 'buff';
    else out.glow[target] = 'acting';
  }

  // De handelende kaart licht wit op, tenzij ze zelf al geraakt wordt.
  const actor = ids[0];
  if (!out.glow[actor]) out.glow[actor] = 'acting';

  return out;
}
