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

/** Welke kant van het serverresultaat de kijker is. */
export type Perspective = 'p1' | 'p2';

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

// ---------------------------------------------------------------------------
// Het draaiboek: van ruwe engine-log naar een reeks beats om af te spelen.
//
// De ruwe log is een verslag voor mensen die alles willen nalezen — dat blijft
// integraal in het Combat Log staan. De aankondiger in het midden van het
// scherm is iets anders: een hoogtepuntenreel. Regel-voor-regel afdraaien gaf
// 219 beats van 2,5s = ruim 9 minuten, waarvan ~45 scheidingslijnen, tientallen
// kopjes, en de opstelling in 55 losse stappen omdat kaartnaam en kaarttekst
// apart kwamen.
// ---------------------------------------------------------------------------

export type BeatKind = 'title' | 'phase' | 'lineup' | 'action' | 'score' | 'finale';

export interface Beat {
  kind: BeatKind;
  /** Wat de speler leest. */
  text: string;
  /** Naam van de kaart, bij een opstellingsbeat. */
  card?: string;
  /** De originele regel(s), voor parseBattleLine — die heeft de COC_-id's nodig. */
  raw: string;
  /** Speelduur in ms bij normale snelheid. */
  duration: number;
  /** Standen die bij deze beat horen. */
  score?: { p1?: number; p2?: number };
}

// Getoetst op de echte regels, die er zo uitzien (mét ** eromheen):
//   "🔄 **Start Phase Begins!**"      "🧱 **Projects**"
//   "• 🟩 `COC_FFS_E2` — 💰 29 MC"    "   ↳ *Steal +4 MC from an enemy Project*"
//   "📊 Player 1 MC after Start: **127.0**"      "---------------"
const DROP_PATTERNS: RegExp[] = [
  /^[━─—–\-_=*·.]{3,}$/,                     // scheidingslijnen, dik en dun
  /^(Projects|Supports|Founder)$/i,          // kopjes binnen de opstelling
  /Lineup$/i,
  /—\s*triggered\s*\(/i,                     // kopje boven de ↳-regels die het al zeggen
  /could not act|⛔|skipped\b|no valid targets/i,
  /→\s*[✅❌]/,                                // conditie-toets zonder gevolg
  /starts with base MC/i,                    // staat al als badge op elke kaart
];

const SCORE_AFTER = /Player\s+([12])\s+MC after\s+\w+:\s*([-\d.]+)/;
const SCORE_OPEN = /Player\s+([12])\s+(?:opens with|responds with)\s*([-\d.]+)\s*MC/;
const PHASE_BANNER = /^(\w[\w ]*?)\s+Phase(?:\s+Begins!?)?$/i;
// Bewust [^`]* voor de kleur-emoji: een emoji-tekenklasse is een surrogaatpaar
// en gedraagt zich onbetrouwbaar zonder de u-vlag.
const LINEUP_CARD = new RegExp(String.raw`^•\s*[^\`]*\`?(${CARD_PATTERN})\`?\s*(?:—\s*💰\s*([\d.]+)\s*MC)?$`);
const CONTINUATION = /^\s*↳/;
// Geen ^-anker: de regel begint met een pijltje en een emoji.
const REDUNDANT_BUFF = new RegExp(String.raw`(${CARD_PATTERN})\s+(?:buffed|debuffed)\s*\([-+]`, 'i');

/** Haalt de sierregels weg: bullets, pijltjes, backticks, sterretjes, dubbele emoji. */
function tidy(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/^\s*[↳•]\s*/, '')
    .replace(/[`*]/g, '')
    .replace(/([\p{Extended_Pictographic}☀-➿])(\s*\1)+/gu, '$1') // 💥 💥 -> 💥
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** COC_EVT_High_risk_high_reward -> "High risk high reward" */
export function prettyCardName(id: string): string {
  return id
    .replace(/^COC_/, '')
    .replace(/^(?:INF|EVT|COM)_/, '')
    .replace(/_/g, ' ')
    .trim();
}

// Emoji dragen hier geen betekenis die de gloed en de kaarten niet al geven.
// Ze maken de zin alleen langer en rommeliger.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;

function humanise(line: string, perspective: Perspective): string {
  const mine = perspective === 'p2' ? '2' : '1';
  return tidy(line)
    .replace(new RegExp(String.raw`Player\s+${mine}['’]s`, 'g'), 'Your')
    .replace(/Player\s+[12]['’]s/g, 'Their')
    .replace(new RegExp(String.raw`\bPlayer\s+${mine}\b`, 'g'), 'You')
    .replace(/\bPlayer\s+[12]\b/g, 'Opponent')
    .replace(new RegExp(CARD_PATTERN, 'g'), (m) => prettyCardName(m))
    .replace(EMOJI, '')
    // "Player 1 gains" wordt "You gains"; de werkwoordsvorm moet mee.
    .replace(/\bYou (gain|lose|steal|boost|reduce|destroy|hold|draw|swap)s\b/g, 'You $1')
    // 29.0 -> 29: hele getallen lezen rustiger, halve waarden blijven staan.
    .replace(/(\d+)\.0\b/g, '$1')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s—–-]+/, '')
    .trim();
}

export function buildBattleScript(logs: string[] | undefined, perspective: Perspective = 'p1'): Beat[] {
  const lines = (logs || [])
    .flatMap((block) => String(block).split('\n'))
    .map((l) => l.replace(/[\r]/g, ' ').trimEnd())
    .filter((l) => l.trim().length > 0);

  const beats: Beat[] = [];
  const pushScore = (side: 'p1' | 'p2', value: number) => {
    const last = beats[beats.length - 1];
    if (last && last.kind === 'score') { last.score = { ...last.score, [side]: value }; return; }
    beats.push({ kind: 'score', text: '', raw: '', duration: 0, score: { [side]: value } });
  };

  for (let i = 0; i < lines.length; i++) {
    // De engine zet ** rond van alles; dat moet eraf vóór we iets herkennen.
    const bare = lines[i].replace(/\*\*/g, '').trim();
    // Zonder aanloop-emoji, zodat "🔄 Start Phase Begins!" gewoon matcht.
    const letters = bare.replace(/^[^\p{L}\p{N}•]+/u, '').trim();

    const score = bare.match(SCORE_AFTER) || bare.match(SCORE_OPEN);
    if (score) { pushScore(score[1] === '1' ? 'p1' : 'p2', parseFloat(score[2])); continue; }

    if (DROP_PATTERNS.some((re) => re.test(bare) || re.test(letters))) continue;

    if (/Battle Begins/i.test(bare)) {
      beats.push({ kind: 'title', text: 'The Battle Begins', raw: bare, duration: 1800 });
      continue;
    }

    const phase = letters.match(PHASE_BANNER);
    if (phase) {
      beats.push({ kind: 'phase', text: `${phase[1].trim()} Phase`, raw: bare, duration: 1500 });
      continue;
    }

    // Opstelling: kaartregel plus de bijbehorende beschrijving tot één beat.
    // De beschrijving staat tussen sterretjes en loopt soms over meerdere
    // regels door; we lezen door tot het sterretje weer sluit.
    const lineup = bare.match(LINEUP_CARD);
    if (lineup) {
      const parts: string[] = [];
      let stars = 0;
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j].replace(/\*\*/g, '');
        if (parts.length === 0 ? !CONTINUATION.test(next) : stars % 2 === 0) break;
        parts.push(tidy(next));
        stars += (next.match(/\*/g) || []).length;
        j++;
      }
      i = j - 1;
      const mc = lineup[2] ? `${parseFloat(lineup[2])} MC` : '';
      const omschrijving = parts.join(' ').replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
      beats.push({
        kind: 'lineup',
        card: prettyCardName(lineup[1]),
        text: [mc, omschrijving].filter(Boolean).join(' · '),
        raw: bare,
        duration: omschrijving.length > 90 ? 1800 : 1300,
      });
      continue;
    }

    // Een "X buffed (+2.0)" die direct gevolgd wordt door de volledige zin over
    // dezelfde kaart is dubbelop.
    const redundant = tidy(bare).match(REDUNDANT_BUFF);
    if (redundant) {
      const next = lines.slice(i + 1, i + 4).find((l) => l.includes(redundant[1]) && l.includes('→'));
      if (next) continue;
    }

    const text = humanise(bare, perspective);
    if (text.replace(/[^\p{L}\p{N}]/gu, '').length < 3) continue;

    // De engine meldt een vernietiging soms twee keer achter elkaar, in andere
    // bewoordingen ("destroyed Their X!" en "destroys enemy X (75% branch)").
    // Er kan een tussenregel tussen staan ("First friendly Project destroyed"),
    // dus we kijken een paar beats terug.
    const gesloopt = bare.match(DESTROY_RE)?.[1];
    if (gesloopt) {
      const recent = beats.filter((b) => b.kind === 'action').slice(-3);
      if (recent.some((b) => b.raw.match(DESTROY_RE)?.[1] === gesloopt)) continue;
    }

    const heavy = /destroy|steals|reflect|doubl/i.test(bare);
    beats.push({ kind: 'action', text, raw: bare, duration: heavy ? 3000 : 2300 });
  }

  beats.push({ kind: 'finale', text: 'Match Concluded', raw: '--- FINALIZE ---', duration: 1200 });

  // Een fase waarin niemand iets deed hoeft niet aangekondigd te worden.
  return beats.filter((b, i) => {
    if (b.kind !== 'phase') return true;
    const volgende = beats.slice(i + 1).find((n) => n.kind !== 'score');
    return volgende !== undefined && volgende.kind !== 'phase' && volgende.kind !== 'finale';
  });
}
