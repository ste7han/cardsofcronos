"use client";

// Your profile: what you have played, and what is attached to your wallet.
//
// Two halves that must not be confused with each other, because the whole page
// is worthless if they are. Solo matches are computed in this browser against a
// bot: fine for "how is this deck doing", worthless as a ladder, and the page
// says so in the section header rather than in a footnote. Rank comes from
// staked PvP, which does not exist yet — so it shows the real starting position
// and how far off it is, instead of a number invented to fill the space.

import Link from "next/link";

import { formatMC } from "@/engine/format";
import { RULES } from "@/engine/types";
import { byDeck, history, tally, type DeckRow, type MatchOutcome } from "@/lib/history";
import { LINKABLE, TELEGRAM_BOT, type Network } from "@/lib/links";
import { Claim } from "@/components/Claim";
import { CardsSummary } from "@/components/YourCards";
import { HOLDER_TIERS, nextTier, tierFor } from "@/data/holder-tiers";
import { toTokens } from "@/lib/units";
import { TelegramLink } from "@/components/TelegramLink";
import { proofOf } from "@/lib/session";
import { useSession } from "@/lib/use-session";
import { useCallback, useEffect, useState } from "react";

/** Settled in DESIGN.md, and the same numbers the ladder will start from. */
const RANK_AT_FIRST_LOGIN = 1000;
const TIERS_OPEN_AFTER = 10;

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

const day = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-panel px-4 py-4">
      <dt className="text-[8px] tracking-[0.18em] text-faint">{label}</dt>
      <dd className="display mt-1.5 text-2xl tabular-nums">{value}</dd>
      {note && <p className="mt-0.5 text-[9px] text-muted">{note}</p>}
    </div>
  );
}

interface Standing {
  record: { wins: number; losses: number; draws: number };
  /** Where this wallet actually sits, not where everybody starts. */
  rank: number;
  /** How many staked matches that rank rests on. The top tiers open at ten. */
  staked: number;
  /** Base units as decimal strings, or null when the chain would not answer. */
  held: string | null;
  /** What the contract has paid this wallet across its whole life. */
  taken: string | null;
  /** What pressing the button would pay right now. */
  claimable: string | null;
  /** Everything the live tree says they have earned. */
  earned: string | null;
  drop: string | null;
}

export function Profile() {
  const { wallet, admin, ready } = useSession();
  const [matches, setMatches] = useState<MatchOutcome[] | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);

  // After mount and on the wallet changing, like everything else that reads
  // storage. A server render that guesses is a hydration mismatch.
  useEffect(() => {
    if (!ready) return;
    setMatches(wallet === null ? [] : history());
  }, [ready, wallet]);

  useEffect(() => {
    if (!ready || wallet === null) return;
    void (async () => {
      const proof = proofOf();
      if (proof === null) return;
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof }),
      });
      if (response.ok) setStanding((await response.json()) as Standing);
    })();
  }, [ready, wallet]);

  if (ready && wallet === null) {
    return (
      <div className="panel border border-line px-6 py-16 text-center">
        <p className="text-[10px] tracking-[0.28em] text-faint">NOT SIGNED IN</p>
        <h2 className="display mt-3 text-2xl">A PROFILE IS A WALLET</h2>
        <p className="mx-auto mt-4 max-w-md text-[11px] leading-relaxed text-muted">
          Everything on this page hangs off an address: what you hold, what you have played, what
          you are ranked and what is linked to you. Sign in and it is here.
        </p>
        <p className="mt-8 text-[10px] tracking-[0.18em] text-pump">
          USE THE WALLET BUTTON, TOP RIGHT
        </p>
      </div>
    );
  }

  const all = matches ?? [];
  const overall = tally(all);
  const decks = byDeck(all);

  return (
    <div className="space-y-10">
      <section className="panel border border-line px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] text-faint">WALLET</p>
            <p className="mt-1 font-mono text-[11px] break-all text-fg">{wallet ?? "—"}</p>
          </div>
          {admin && (
            <span className="border border-gold px-2.5 py-1 text-[9px] tracking-[0.18em] text-gold">
              ADMIN
            </span>
          )}
        </div>
      </section>

      <Holding standing={standing} wallet={wallet} />

      {/* What you actually bought. It sits under the balance and above the
          decks because that is the order somebody reads them in: what I have,
          what it is worth, what I built with it. The cards themselves are a
          page of their own — see app/profile/cards for why. */}
      <CardsSummary wallet={wallet} />

      {/* Rank after holding, because holding is the thing that pays and rank is
          the thing that will. Empty is the honest answer for both today. */}
      <section>
        <h2 className="display text-xl">RANK</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          A plain Elo, moved only by staked matches. Friendly matches and anything against the
          market leave it alone — dropping a rank has to cost a stake rather than an afternoon.
        </p>

        <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
          <Figure
            label="RANK"
            value={String(standing?.rank ?? RANK_AT_FIRST_LOGIN)}
            note={
              standing === null || standing.rank === RANK_AT_FIRST_LOGIN
                ? "Where everyone starts"
                : standing.rank > RANK_AT_FIRST_LOGIN
                  ? `Up ${standing.rank - RANK_AT_FIRST_LOGIN} from the start`
                  : `Down ${RANK_AT_FIRST_LOGIN - standing.rank} from the start`
            }
          />
          <Figure
            label="STAKED MATCHES"
            value={`${standing?.staked ?? 0} / ${TIERS_OPEN_AFTER}`}
            note="Top tiers open at ten"
          />
          <Figure
            label="RECORD"
            value={
              standing === null || standing.record.wins + standing.record.losses + standing.record.draws === 0
                ? "—"
                : `${standing.record.wins}–${standing.record.losses}${standing.record.draws > 0 ? `–${standing.record.draws}` : ""}`
            }
            note="Wins · losses, from every PvP match"
          />
        </dl>

        {/* Said only while it is true. It used to say the lobby was "the next
            thing being built" — which stopped being true the day the lobby
            shipped, and a page explaining an empty number with a reason that no
            longer holds is worse than one that says nothing. */}
        {(standing?.staked ?? 0) === 0 && (
          <p className="mt-3 text-[10px] leading-relaxed text-gold">
            Nothing has moved this yet. A rank only moves on a match with CRO on it, and nobody has
            finished one — friendly matches and the market leave it exactly where it is.{" "}
            <Link href="/pvp" className="underline hover:text-fg">
              The lobby is here
            </Link>
            .
          </p>
        )}
      </section>

      <section>
        <h2 className="display text-xl">AGAINST THE MARKET</h2>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Every finished match against the bot, kept in this browser.{" "}
          <span className="text-fg">This is not a rank and it never will be</span> — it is worked
          out on your own machine, so it is worth what your honesty is worth. As a read on how a
          deck is doing that is plenty; as a ladder it is nothing.
        </p>

        <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-4">
          <Figure label="PLAYED" value={String(overall.played)} />
          <Figure
            label="WIN RATE"
            value={overall.played === 0 ? "—" : `${Math.round(overall.winRate * 100)}%`}
            note={overall.played === 0 ? undefined : `${overall.won}W · ${overall.lost}L · ${overall.drawn}D`}
          />
          <Figure
            label="BEST MC"
            value={overall.played === 0 ? "—" : formatMC(overall.bestMC)}
          />
          <Figure
            label="AVERAGE MC"
            value={overall.played === 0 ? "—" : formatMC(overall.averageMC)}
            note={overall.played === 0 ? undefined : `Over ${RULES.turns} turns`}
          />
        </dl>

        {matches === null ? (
          <p className="mt-4 text-[10px] tracking-[0.16em] text-faint">READING…</p>
        ) : decks.length === 0 ? (
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            No finished matches yet.{" "}
            <Link href="/play" className="text-pump hover:underline">
              Play one
            </Link>{" "}
            and it turns up here. Demo matches do not count — a borrowed deck is nobody&rsquo;s
            record.
          </p>
        ) : (
          <DeckTable rows={decks} />
        )}
      </section>

      <LinkedAccounts />
    </div>
  );
}

/**
 * What you hold and what holding it has paid you.
 *
 * Half of every mint, royalty and ranked match is bought as $CROCARD and shared
 * out among the people holding it, so this is the section the rest of the
 * economy points at. Three facts and no invitation: what is in the wallet, what
 * that makes you, and what has actually arrived.
 *
 * READING NOTHING IS NOT THE SAME AS HOLDING NOTHING, which is why every figure
 * here has a third state. An RPC that would not answer must not print a zero
 * balance next to a tier calculated from it — that is a page telling somebody
 * they are on the retail rate when they are not.
 *
 * ONE FIGURE FOR WHAT WAS RECEIVED, and not three. The splitter cannot tell a
 * mint from a royalty from a match's cut: CRO arrives in one balance, leaves in
 * one swap, and is divided after that — so by the time a share reaches a holder
 * there is nothing left in it that says where it came from. Three numbers here
 * would be three guesses. Saying so on the page is the point: somebody looking
 * for the breakdown should find out it does not exist rather than assume it is
 * being kept somewhere they cannot see.
 */
function Holding({ standing, wallet }: { standing: Standing | null; wallet: string | null }) {
  const held = standing?.held == null ? null : toTokens(standing.held);
  const tier = tierFor(held);
  const next = nextTier(held);

  const whole = (value: number) => Math.round(value).toLocaleString("en-US");

  return (
    <section>
      <h2 className="display text-xl">$CROCARD</h2>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
        Half of every paid mint, every royalty and every ranked match is bought as $CROCARD and
        shared out among the people holding it. Holding also decides what is taken from a win —
        the more you hold, the more of your own prize you keep.
      </p>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
        What you have received is one figure and not three. The three streams are pooled before
        anything is bought, so a share that reaches you no longer says which of them paid for it.
        It builds up day by day and you collect it in one go, whenever you want to.
      </p>

      <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
        <Figure
          label="HELD"
          value={held === null ? "—" : whole(held)}
          note={held === null ? "Not read" : "$CROCARD"}
        />
        <Figure
          label="TIER"
          value={tier.name}
          note={`${Math.round(tier.cut * 100)}% taken when you win`}
        />
        <Figure
          label="RECEIVED"
          value={standing?.taken == null ? "—" : whole(toTokens(standing.taken))}
          note={standing?.drop == null ? "Nothing pays out yet" : "Paid out so far, all three streams"}
        />
      </dl>

      {/* Only the rung above, and only when there is one. A ladder that lists
          every rung a wallet is not on reads as a page asking somebody to buy
          more, which is not what this section is for. */}
      {held !== null && next !== null ? (
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          {whole(next.atLeast - held)} more is {next.name}, where {Math.round(next.cut * 100)}% is
          taken instead of {Math.round(tier.cut * 100)}%.
        </p>
      ) : null}

      {held !== null && next === null && tier.id === HOLDER_TIERS[0]!.id ? (
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          Top rung. Nothing above this one.
        </p>
      ) : null}

      {/* The button says what is waiting and offers to move it, so a sentence
          saying the same thing above it would be the same fact twice. */}
      <Claim wallet={wallet} />

      <p className="mt-3 max-w-2xl text-[10px] leading-relaxed text-gold">
        {standing?.drop == null
          ? "Nothing has been minted and the contract that shares it out is not deployed, so nothing has been paid to anybody yet. What is held above is read from the chain and is real."
          : "What has been received is the contract's own tally across every round, and it is the same number your wallet saw arrive."}
      </p>
    </section>
  );
}

function DeckTable({ rows }: { rows: readonly DeckRow[] }) {
  return (
    <div className="mt-5 overflow-x-auto border border-line">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[8px] tracking-[0.18em] text-faint">
            <th className="px-4 py-3 font-normal">DECK</th>
            <th className="px-4 py-3 text-right font-normal">PLAYED</th>
            <th className="px-4 py-3 text-right font-normal">WIN RATE</th>
            <th className="px-4 py-3 text-right font-normal">AVERAGE MC</th>
            <th className="px-4 py-3 text-right font-normal">LAST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.deckKey} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-[11px] text-fg">{row.name}</td>
              <td className="px-4 py-3 text-right text-[11px] tabular-nums text-muted">
                {row.played}
              </td>
              <td className="px-4 py-3 text-right text-[11px] tabular-nums">
                <span className={row.winRate >= 0.5 ? "text-pump" : "text-dump"}>
                  {Math.round(row.winRate * 100)}%
                </span>{" "}
                <span className="text-faint">
                  {row.won}–{row.lost}
                  {row.drawn > 0 ? `–${row.drawn}` : ""}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-[11px] tabular-nums text-muted">
                {formatMC(row.averageMC)}
              </td>
              <td className="px-4 py-3 text-right text-[10px] tabular-nums text-faint">
                {day(row.lastPlayed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Whether the bot can actually reach you, and the one press that fixes it.
 *
 * ── WHY THIS IS NOT JUST A LINK TO THE BOT ───────────────────────────────────
 *
 * Telegram will not let a bot open a conversation, so a linked account is not a
 * reachable one until Start has been pressed. But pressing Start tells the site
 * nothing — no webhook is registered, so the bot does not answer and nothing
 * here hears about it. "Press Start" was therefore an instruction with no
 * outcome: the bot said nothing, this page said nothing, and the only honest
 * reading was that it had not worked.
 *
 * A successful message is the only evidence that ever arrives, so there is a
 * button that asks for one. It doubles as the diagnostic — Telegram's refusals
 * mean different things, and the route turns the one it gave into the next step.
 */
function TelegramAlerts({
  problem,
  onChanged,
}: {
  problem: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [trying, setTrying] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  async function tryIt() {
    const proof = proofOf();
    if (proof === null) {
      setSaid("Sign in with a wallet first.");
      return;
    }
    setTrying(true);
    setSaid(null);
    try {
      const response = await fetch("/api/link/telegram/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof }),
      });
      const body = (await response.json()) as { sent?: boolean; error?: string };
      if (body.sent === true) {
        setSaid("Sent. Look in Telegram.");
        // Clears the warning above, because the row has just been updated.
        await onChanged();
        return;
      }
      setSaid(body.error ?? "That did not go through.");
    } catch {
      setSaid("Could not reach the server. Try again in a moment.");
    } finally {
      setTrying(false);
    }
  }

  if (TELEGRAM_BOT === null) {
    return (
      <p className="mt-4 border border-line-strong px-3 py-2 text-[10px] leading-relaxed text-faint">
        Turn alerts are not switched on yet.
      </p>
    );
  }

  const blocked = problem === "blocked";

  return (
    <div className="mt-4 border border-line-strong p-3">
      <p className="text-[10px] leading-relaxed text-muted">
        {problem === null ? (
          <>
            <span className="text-pump">Turn alerts are on.</span> You will hear about a slow match
            when it is your turn, and about a match starting in a seat you offered.
          </>
        ) : blocked ? (
          <>
            You blocked @{TELEGRAM_BOT}, so nothing can be sent. Unblock it in Telegram, then try
            again below.
          </>
        ) : (
          <>
            Linked, but nothing has reached you yet. Telegram only lets a bot message you after you
            have pressed Start once.{" "}
            {/* Said out loud because the silence is what makes people think it
                failed: the bot has no webhook and answers nothing. */}
            <span className="text-faint">
              The bot will not reply when you do — it only sends. Use the button to check.
            </span>
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {problem !== null && (
          <a
            href={`https://t.me/${TELEGRAM_BOT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gold px-3 py-1.5 text-[10px] tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-ground"
          >
            {blocked ? "OPEN TELEGRAM" : "PRESS START"} →
          </a>
        )}
        <button
          type="button"
          onClick={() => void tryIt()}
          disabled={trying}
          className="border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-pump hover:text-pump disabled:opacity-50"
        >
          {trying ? "SENDING…" : "SEND ME A TEST"}
        </button>
      </div>

      {said !== null && <p className="mt-2 text-[10px] leading-relaxed text-fg">{said}</p>}
    </div>
  );
}

interface Attached {
  network: Network;
  handle: string;
  linkedAt: number;
  /** Why we cannot reach them there, or null when we can. See lib/notify.ts. */
  dmProblem: string | null;
}

/**
 * What the callback said, if we have just come back from one.
 *
 * Read from the query string because the round trip goes through X and there is
 * no other way home. Every outcome is a word rather than a code, so the URL
 * somebody pastes into a message says what happened.
 */
function outcomeOf(search: URLSearchParams): { tone: "good" | "bad"; text: string } | null {
  const link = search.get("link");
  if (!link) return null;
  const handle = search.get("handle");

  switch (link) {
    case "x":
    case "telegram":
      return { tone: "good", text: `Linked to @${handle ?? "your account"}.` };
    case "taken":
      return {
        tone: "bad",
        text: `@${handle ?? "That account"} is already attached to a different wallet. One account, one wallet — that rule is what makes the points worth anything.`,
      };
    case "cancelled":
      return { tone: "bad", text: "You turned it down on X. Nothing happened." };
    case "expired":
      return { tone: "bad", text: "That took too long and the request expired. Start it again." };
    case "mismatch":
      return { tone: "bad", text: "That callback did not belong to this request. Start it again." };
    case "signedout":
      return { tone: "bad", text: "Your session ran out while you were on X. Sign in and try again." };
    case "unconfigured":
      return { tone: "bad", text: "Linking is not configured on this server yet." };
    default:
      return { tone: "bad", text: "X could not be reached. Nothing was linked." };
  }
}

function LinkedAccounts() {
  const [attached, setAttached] = useState<Attached[] | null>(null);
  const [busy, setBusy] = useState<Network | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReturnType<typeof outcomeOf>>(null);

  const load = useCallback(async () => {
    const proof = proofOf();
    if (proof === null) {
      setAttached([]);
      return;
    }
    try {
      const response = await fetch("/api/link/me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof }),
      });
      if (!response.ok) throw new Error(await response.text());
      const { links } = (await response.json()) as { links: Attached[] };
      setAttached(links);
    } catch {
      // An empty list and a list that could not be read are different things,
      // and showing "not linked" for the second would invite somebody to link an
      // account they already have.
      setAttached(null);
      setProblem("Could not reach the server to read your linked accounts.");
    }
  }, []);

  useEffect(() => {
    void load();
    setOutcome(outcomeOf(new URLSearchParams(window.location.search)));
    // The message stays; the query string goes, so a refresh does not replay it.
    window.history.replaceState({}, "", window.location.pathname);
  }, [load]);

  async function connect(network: Network) {
    setBusy(network);
    setProblem(null);
    try {
      const proof = proofOf();
      if (proof === null) throw new Error("Sign in with a wallet first.");

      const response = await fetch(`/api/link/${network}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "The server would not start it.");

      window.location.href = body.url;
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function disconnect(network: Network) {
    setBusy(network);
    setProblem(null);
    try {
      const proof = proofOf();
      if (proof === null) throw new Error("Sign in with a wallet first.");
      const response = await fetch("/api/link/unlink", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof, network }),
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="display text-xl">LINKED ACCOUNTS</h2>
      <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
        So you can be reached about a match or a prize without anybody asking who you are. An
        account attaches to exactly one wallet, and linking is something the network confirms
        rather than a handle you type — anyone can type a handle.
      </p>

      {outcome && (
        <p
          className={`mt-4 max-w-2xl border px-4 py-3 text-[11px] leading-relaxed ${
            outcome.tone === "good"
              ? "border-pump/40 bg-pump/5 text-pump"
              : "border-dump/40 bg-dump/5 text-dump"
          }`}
        >
          {outcome.text}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(Object.keys(LINKABLE) as Network[]).map((network) => {
          const it = LINKABLE[network];
          const link = attached?.find((a) => a.network === network) ?? null;

          return (
            <div key={network} className="panel border border-line p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="display text-lg">{it.name}</p>
                <span
                  className={`text-[9px] tracking-[0.18em] ${link ? "text-pump" : "text-faint"}`}
                >
                  {attached === null ? "—" : link ? `@${link.handle}` : "NOT LINKED"}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">{it.why}</p>

              {!it.built ? (
                <p className="mt-4 border border-line-strong px-3 py-2 text-center text-[10px] tracking-[0.18em] text-faint">
                  NOT SWITCHED ON YET
                </p>
              ) : link ? (
                <>
                  {/* Linked is not the same as reachable, and this is the only
                      place that difference can be fixed.

                      Telegram will not let a bot open a conversation: the
                      person presses Start once, and until they have, every
                      message is refused. Without this the feature fails in the
                      quietest possible way — the account says LINKED, the
                      profile says nothing, and no notification ever arrives. */}
                  {network === "telegram" && (
                    <TelegramAlerts problem={link.dmProblem} onChanged={load} />
                  )}
                  <button
                    type="button"
                    onClick={() => void disconnect(network)}
                    disabled={busy === network}
                    className="mt-4 w-full border border-line-strong px-3 py-2 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-dump hover:text-dump disabled:opacity-50"
                  >
                    {busy === network ? "…" : "UNLINK"}
                  </button>
                </>
              ) : network === "telegram" ? (
                <TelegramLink />
              ) : (
                <button
                  type="button"
                  onClick={() => void connect(network)}
                  disabled={busy === network}
                  className="glow-pump mt-4 w-full border border-pump bg-pump/10 px-3 py-2 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-muted disabled:shadow-none"
                >
                  {busy === network ? "TAKING YOU TO X…" : `LINK ${it.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {problem && <p className="mt-3 text-[10px] leading-relaxed text-dump">{problem}</p>}

      <p className="mt-4 max-w-2xl text-[10px] leading-relaxed text-faint">
        Neither asks for more than who you are. X grants no posting and no email address; Telegram
        is asked whether the bot may message you, which is what makes &ldquo;it is your turn&rdquo;
        possible later. Take either off again here and the account is free for another wallet.
      </p>
    </section>
  );
}
