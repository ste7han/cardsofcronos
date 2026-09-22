"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";

import { CardSizePicker } from "@/components/CardSizePicker";
import { CardView } from "@/components/CardView";
import { Icon } from "@/components/Icon";
import { byDeck, deckKey, history as matchHistory, type DeckRow } from "@/lib/history";
import {
  buildDeck,
  countProjects,
  deckProblems,
} from "@/engine/deck";
import type { Card, CardType, Rarity, Sector } from "@/engine/types";
import {
  CARD_TYPES,
  MARKETING_COST,
  RARITIES,
  RULES,
  SECTORS,
} from "@/engine/types";
import { formatMC, searchText } from "@/engine/format";
import {
  clearDeck,
  deleteSavedDeck,
  loadDeck,
  playSavedDeck,
  saveDeckAs,
  savedDecks,
  type SavedDeck,
  type LoadedDeck,
} from "@/lib/deck-storage";
import { DECK_FROM_COLLECTION, copiesHeld, poolCards, poolFor } from "@/lib/collection";
import { useDecks } from "@/lib/use-decks";
import { useSession } from "@/lib/use-session";
import { sizeOf, useCardSize } from "@/lib/card-size";
import { cx } from "@/lib/cx";
import { RARITY, SECTOR_LABEL, TYPE_LABEL } from "@/lib/rarity";
import { INDEX, SET } from "@/lib/set";

export function DeckBuilder() {
  // Loaded after mount, not during render. loadDeck reads localStorage, which
  // does not exist on the server, so calling it in a useMemo made the server
  // render the starter deck and the client render the saved one — a hydration
  // mismatch that React papered over by throwing the tree away and redoing it.
  const [initial, setInitial] = useState<LoadedDeck>(() => ({
    cardIds: [],
    name: "",
    rejected: [],
  }));
  /** What you call this deck. Shown to you at the table and to nobody else. */
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  /** A save is a round trip now, and a button that did not say so looked stuck. */
  const [saving, setSaving] = useState(false);
  /**
   * The cards this player owns. Empty until after mount, because the collection
   * lives in localStorage — the same reason the deck is loaded in an effect.
   */
  const { wallet, ready: sessionReady } = useSession();
  const { stamp } = useDecks();
  const [pool, setPool] = useState<Card[]>([]);
  /** How many of each card this player holds. Second copies are trade, not deck. */
  const [copies, setCopies] = useState<Map<string, number>>(() => new Map());
  /**
   * Whether the collection has been read yet. Without this every card renders as
   * NOT OWNED for one frame — the pool is empty until the effect runs, and a
   * flash of "you own nothing" is a worse lie than no marking at all.
   */
  const [poolReady, setPoolReady] = useState(false);

  /**
   * Set when the collection could not be read at all.
   *
   * Not the same as holding nothing, and the page says them differently. A
   * builder that answered "you own no cards" because a request timed out would
   * be telling somebody their 53 cards are gone.
   */
  const [poolFailed, setPoolFailed] = useState(false);

  /** The decks this wallet has saved, newest first, and what each has done. */
  const [mine, setMine] = useState<SavedDeck[]>([]);
  const [records, setRecords] = useState<Map<string, DeckRow>>(new Map());

  /** The name being typed. Saving without one gets "Deck 3" rather than "". */
  const [deckName, setDeckName] = useState("");
  /** Why the last save was refused, if it was. */
  const [saveFailed, setSaveFailed] = useState<string[]>([]);

  // Keyed on the wallet, not just on mount. Signing in or out changes whose
  // cards these are, and a builder still holding the last wallet's deck would be
  // offering to save cards this one does not own.
  //
  // ── IT ASKS THE CHAIN NOW ────────────────────────────────────────────────
  //
  // This read localStorage, which was the whole collection while the mint was a
  // rehearsal. The moment there was a contract it became the wrong answer: a
  // wallet holding 53 real cards was told it had none. poolFor adds both — the
  // local ones still exist for whoever opened rehearsal packs — and the chain
  // is the half that matters.
  useEffect(() => {
    let current = true;

    // Synchronously first, so somebody with rehearsal cards is not looking at
    // an empty grid while a request is in flight.
    setPool(poolCards());
    setCopies(copiesHeld());

    void (async () => {
      try {
        const { cards, copies: held } = await poolFor(wallet);
        if (!current) return;
        setPool(cards);
        setCopies(held);
        setPoolFailed(false);
      } catch {
        if (!current) return;
        // The local half is already on screen. What is missing is the chain, and
        // the notice says so rather than the grid quietly being short.
        setPoolFailed(true);
      } finally {
        if (current) setPoolReady(true);
      }
    })();

    // The cache, which useDecks fills from the server. On a browser this wallet
    // has never built a deck in it is empty until that lands, and `stamp` in the
    // deps is what brings this effect back round when it does.
    const stored = loadDeck();
    setInitial(stored);
    setPicked(stored.cardIds);
    setName(stored.name);
    setDeckName(stored.name);
    setSaved(stored.cardIds.length > 0);

    setMine(savedDecks());
    // Keyed by what the deck holds rather than by its id, so a record survives
    // a rename and follows the cards.
    setRecords(new Map(byDeck(matchHistory()).map((row) => [row.deckKey, row])));

    // A wallet switched mid-request must not have the old one's cards land on
    // top of it.
    return () => {
      current = false;
    };
  }, [wallet, stamp]);

  const [type, setType] = useState<CardType | null>(null);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [search, setSearch] = useState("");
  /** Which ready-made deck is on screen, so the button can show it. */
  const [loaded, setLoaded] = useState<string | null>(null);
  /**
   * Hide the cards you do not own, rather than showing them greyed out.
   *
   * On by default once a deck may only hold cards you own, and it was off for a
   * while after that rule came back — which meant building a deck out of sixty
   * cards while looking at six hundred and fifty-five, with the ones you could
   * actually use scattered through them. The set is still worth browsing, so the
   * toggle stays; it just no longer starts pointed at the wrong thing.
   */
  const [onlyOwned, setOnlyOwned] = useState(DECK_FROM_COLLECTION);
  const [size, setSize] = useCardSize();
  const step = sizeOf(size);

  const inDeck = useMemo(() => new Set(picked), [picked]);
  // What the deck costs to play, not to build: there is no deck budget any more.
  const avgCost =
    picked.length > 0
      ? picked.reduce(
          (sum, id) => sum + MARKETING_COST[INDEX.get(id)!.rarity],
          0,
        ) / picked.length
      : 0;
  const curve = RARITIES.map((r) => ({
    rarity: r,
    n: picked.filter((id) => INDEX.get(id)?.rarity === r).length,
  }));
  const owned = useMemo(() => new Set(pool.map((c) => c.id)), [pool]);
  // The same check the storage layer runs, so the panel cannot say a deck is fine
  // and then have Save refuse it.
  const enforcing = DECK_FROM_COLLECTION && poolReady;
  const problems = deckProblems(picked, INDEX, enforcing ? owned : undefined);
  const legal = problems.length === 0;
  const slotsLeft = RULES.deckSize - picked.length;
  const projects = countProjects(picked, INDEX);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return SET.filter((card) => {
      if (onlyOwned && poolReady && !owned.has(card.id)) return false;
      if (type && card.type !== type) return false;
      if (rarity && card.rarity !== rarity) return false;
      if (sector && (card.type !== "project" || card.sector !== sector))
        return false;
      if (term && !`${card.name} ${card.ticker}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [type, rarity, sector, search, onlyOwned, owned, poolReady]);

  /**
   * A ready-made deck, built out of the cards this player owns.
   *
   * It leans towards the theme rather than being made of it — the builder has
   * always worked that way, because no sector has forty cards. With a small
   * collection it leans less, which is exactly what owning less means.
   */
  /** Puts one of your saved decks on the table. */
  /**
   * Opens one of your decks, and makes it the one you play.
   *
   * It used to do only the first half, and the row lit up as though it had done
   * both — so picking a deck here and walking to /play dealt whatever was there
   * before, with nothing on either screen disagreeing. The seat is a fact on the
   * server now, and picking a deck is what moving it means.
   */
  /**
   * Saves what is on screen, from wherever the button was.
   *
   * One function because there are two buttons now — the panel's and the one
   * in the bar at the bottom of a phone — and a second copy of this is the
   * trap this project keeps writing down: the phone bar has to tell the deck
   * list and the wallet, and the copy that forgets leaves a stale list on a
   * screen where the list is scrolled out of sight anyway.
   */
  function save() {
    if (!legal || saving) return;
    // Saving over the one on screen when it came from the list, and adding one
    // otherwise. Editing a deck and saving should not quietly leave the old
    // version behind.
    const editing = mine.find((deck) => deck.id === loaded);
    setSaving(true);
    void saveDeckAs(picked, deckName, editing?.id).then(({ problems: failed, id }) => {
      setSaving(false);
      setSaveFailed(failed);
      setSaved(failed.length === 0);
      if (failed.length > 0) return;
      setMine(savedDecks());
      setName(deckName.trim());
      if (id !== undefined) setLoaded(id);
    });
  }

  function clear() {
    setPicked([]);
    setSaved(false);
    setLoaded(null);
  }

  function loadSaved(deck: SavedDeck) {
    setPicked(deck.cardIds);
    setName(deck.name);
    setDeckName(deck.name);
    setLoaded(deck.id);
    setSaved(true);
    void playSavedDeck(deck.id);
  }

  // loadPreset was here. The four ready-made decks went: a player picks between
  // decks they built, and a deck handed over is the thing this game decided
  // against everywhere else. data/preset-decks.ts is still used by scripts/ for
  // measurement.

  /**
   * Fills the table with a legal deck out of the cards you hold.
   *
   * It went with the presets for a moment and came back, and the difference
   * between the two is the whole reason: a preset is a deck somebody else
   * designed, and this is forty of your own cards in an order you did not have
   * to click. Nothing is saved by pressing it — name it and save it, or press
   * it again.
   *
   * `pool` is what the chain says you hold, so there is nothing here to filter:
   * it cannot reach for a card you do not own.
   */
  function rollRandom() {
    // Math.random is fine here: this is a UI convenience, not the engine. A
    // match's randomness runs through the seeded generator so it stays
    // replayable; picking a deck to look at does not have to.
    const from = DECK_FROM_COLLECTION ? pool : SET;
    if (from.length < RULES.deckSize) return;
    setPicked(buildDeck(from, Math.floor(Math.random() * 1_000_000)));
    setLoaded("random");
    setSaved(false);
  }

  function toggle(card: Card) {
    // Dimming is a hint; this is the rule. Clicking a card you do not own does
    // nothing, and saving one would be refused by the storage layer anyway.
    if (enforcing && !owned.has(card.id) && !inDeck.has(card.id)) return;
    setSaved(false);
    setLoaded(null);
    setPicked((current) =>
      current.includes(card.id)
        ? current.filter((id) => id !== card.id)
        : [...current, card.id],
    );
  }

  /** Would adding this card break the deck? Used to dim rather than to enforce. */
  function blocked(card: Card): string | null {
    if (inDeck.has(card.id)) return null;
    if (enforcing && !owned.has(card.id)) return "You don't own this card yet.";
    if (slotsLeft <= 0) return `Your deck is already ${RULES.deckSize} cards.`;
    return null;
  }

  // Signed out. Below every hook, like the branch under it: React counts hooks
  // per render, and an early return between them renders fewer than the last
  // pass and throws.
  //
  // Waits for sessionReady rather than reading `wallet === null` straight away.
  // Before the session has been read those two look the same and mean opposite
  // things — "nobody is signed in" against "we have not looked" — and getting it
  // wrong flashes a locked door at somebody who is signed in perfectly well.
  if (sessionReady && wallet === null) {
    return (
      <div className="panel border border-line px-6 py-16 text-center">
        <p className="text-[10px] tracking-[0.28em] text-faint">NOT SIGNED IN</p>
        <h2 className="display mt-3 text-2xl">A DECK BELONGS TO A WALLET</h2>
        <p className="mx-auto mt-4 max-w-md text-[11px] leading-relaxed text-muted">
          A deck is {RULES.deckSize} cards out of the cards you hold, and holding is something an
          address does rather than a browser. Sign in and your collection follows you to any
          machine — no wallet, no cards, and nothing to build from.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[10px] leading-relaxed text-faint">
          Signing in costs nothing and moves nothing. You sign a line of text, not a transaction.
        </p>
        <p className="mt-8 text-[10px] tracking-[0.18em] text-pump">
          USE THE WALLET BUTTON, TOP RIGHT
        </p>
      </div>
    );
  }

  // Signed in and holding nothing.
  if (poolReady && pool.length === 0) {
    return (
      <div className="panel border border-line px-6 py-16 text-center">
        <p className="text-[10px] tracking-[0.28em] text-faint">EMPTY COLLECTION</p>
        <h2 className="display mt-3 text-2xl">YOU OWN NOTHING YET</h2>
        <p className="mx-auto mt-4 max-w-md text-[11px] leading-relaxed text-muted">
          A deck is {RULES.deckSize} cards out of the cards you own, and you have not minted any.
          Sixty in one go leaves twenty to leave out, which is the part where a deck becomes yours;
          ten at a time is the one you open for the pull.
        </p>
        <Link
          href="/mint"
          className="glow-pump mt-8 inline-block border border-pump bg-pump/10 px-6 py-3 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
        >
          GO TO THE MINT
        </Link>
      </div>
    );
  }

  return (
    // The bottom padding is the height of the bar below. Without it the bar
    // sits on top of the last row of cards, which are the ones somebody
    // scrolled all that way to reach.
    <div className="grid gap-4 max-lg:pb-20 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <div className="panel space-y-3 border border-line p-4">
          <Row label="TYPE">
            {CARD_TYPES.map((t) => (
              <Chip
                key={t}
                active={type === t}
                onClick={() => setType(type === t ? null : t)}
              >
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </Row>
          <Row label="RARITY">
            {RARITIES.map((r) => (
              <Chip
                key={r}
                active={rarity === r}
                colour={RARITY[r].colour}
                onClick={() => setRarity(rarity === r ? null : r)}
              >
                {RARITY[r].label} · {formatMC(MARKETING_COST[r])}
              </Chip>
            ))}
          </Row>
          <Row label="SECTOR">
            {SECTORS.map((s) => (
              <Chip
                key={s}
                active={sector === s}
                onClick={() => setSector(sector === s ? null : s)}
              >
                {SECTOR_LABEL[s]}
              </Chip>
            ))}
          </Row>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search by name or ticker…"
              className="min-w-0 flex-1 border border-line bg-ground px-3 py-1.5 text-[11px] text-fg placeholder:text-muted focus:border-line-strong focus:outline-none"
            />
            {/* Both of these answer "which of these are mine?", which is not a
                question while the mint is shut — every card is. A toggle stuck
                on WHOLE SET and a count reading "610 owned" would each be a
                small lie in the same direction. */}
            {DECK_FROM_COLLECTION && (
              <button
                type="button"
                onClick={() => setOnlyOwned((v) => !v)}
                className={cx(
                  "border px-2 py-1.5 text-[10px] tracking-[0.14em] transition-colors",
                  onlyOwned
                    ? "border-pump text-pump"
                    : "border-line text-muted hover:border-line-strong",
                )}
              >
                {onlyOwned ? "OWNED ONLY" : "WHOLE SET"}
              </button>
            )}
            <CardSizePicker size={size} onPick={setSize} />
            <span className="text-[10px] tracking-[0.14em] text-muted">
              {/* The owned figure waits for the collection, the same way the
                  cards do. Before the effect runs the pool is empty, and this
                  read "0 owned" on every single load — a flash of having
                  nothing, which is the one number nobody wants to see wrong. */}
              {DECK_FROM_COLLECTION
                ? `${visible.length} shown · ${poolReady ? `${owned.size} owned` : "counting"} / ${SET.length}`
                : `${visible.length} of ${SET.length} shown`}
            </span>
          </div>
        </div>

        {/* Said out loud, because the grid below it would otherwise just be
            short and look like an answer. */}
        {poolFailed && (
          <p className="mt-3 border border-dump/40 bg-dump/5 px-4 py-3 text-[11px] leading-relaxed text-dump">
            The cards you hold on chain could not be read, so this is showing less than you own.
            That is this page failing rather than an empty wallet — reload in a moment.
          </p>
        )}

        {/* A column count is the wrong way to lay these out. The full card is
            drawn for about 400px across — that is the width it is rendered at
            for an NFT — and four columns in this panel is 230px, at which the
            wordmark wraps and the rules text runs out of the bottom. A minimum
            width instead: the cards keep their size and the grid decides how
            many fit, which is the same trade the other way round. */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${step.min}px), 1fr))`,
          }}
        >
          {visible.map((card) => (
            <PickableCard
              key={card.id}
              card={card}
              chosen={inDeck.has(card.id)}
              blocked={blocked(card)}
              owned={!enforcing || owned.has(card.id)}
              held={copies.get(card.id) ?? 0}
              compact={step.compact}
              onToggle={toggle}
            />
          ))}
        </div>
      </div>

      {/* The panel grew past the height of a screen once it carried a curve and
          the ready-made decks, and a sticky element taller than the viewport
          stops being sticky: you had to scroll past all 174 cards to reach the
          save button. It is capped to the screen now and scrolls inside itself,
          with the counters pinned and the card list taking whatever is left. */}
      {/* Ordered on purpose. The grid puts the card list first, which is right
          on a desktop where the panel sits beside it — and on a phone the
          columns stack, so the panel landed under four hundred and forty-eight
          cards. Naming a deck, rolling one or saving meant scrolling to the
          bottom of the set first. The panel goes first below lg, and the bar at
          the end of this file keeps the count and the save in reach while you
          are down among the cards. Both come from TCG, which hit this first. */}
      <aside className="max-lg:order-first lg:sticky lg:top-[4.5rem]">
        {/* The cap goes on the panel, not on the aside. The aside is a grid item
            whose height is its content, so max-h-full there resolves to the
            content height and constrains nothing. */}
        <div className="panel flex flex-col border border-line lg:max-h-[calc(100vh-5.5rem)]">
          <div className="shrink-0 overflow-y-auto border-b border-line p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[9px] tracking-[0.2em] text-faint">
                CARDS
              </span>
              <span
                className={cx(
                  "display text-xl",
                  picked.length === RULES.deckSize ? "text-pump" : "text-fg",
                )}
              >
                {picked.length}
                <span className="text-sm text-faint">/{RULES.deckSize}</span>
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[9px] tracking-[0.2em] text-faint">
                AVG COST
              </span>
              <span className="display text-xl text-gold">
                {picked.length > 0 ? formatMC(Math.round(avgCost)) : "—"}
                <span className="text-sm text-faint">
                  /turn {formatMC(RULES.budgetPerTurn)}–
                  {formatMC(RULES.budgetPerTurn * RULES.turns)}
                </span>
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[9px] tracking-[0.2em] text-faint">
                PROJECTS
              </span>
              <span
                className={cx(
                  "display text-xl",
                  projects < RULES.minProjects ? "text-dump" : "text-fg",
                )}
              >
                {projects}
                <span className="text-sm text-faint">
                  /{RULES.minProjects} min
                </span>
              </span>
            </div>

            {/* Bars beat numbers: you see at a glance which limit you are about to
                run into. */}
            <Bar value={picked.length / RULES.deckSize} tone="pump" />
            <Bar
              value={Math.min(1, avgCost / (RULES.budgetPerTurn / 2))}
              tone="gold"
            />
            <Bar
              value={Math.min(1, projects / RULES.minProjects)}
              tone={projects < RULES.minProjects ? "dump" : "pump"}
            />
          </div>

          {/* Everything between the counters and the buttons scrolls. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 max-lg:max-h-[17rem]">
            {/* The curve. Under this system it is the thing you are building, so
                it should be visible while you build it rather than something you
                work out afterwards. */}
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[9px] tracking-[0.2em] text-faint">CURVE</p>
              <div className="mt-2 flex items-end gap-1">
                {curve.map(({ rarity, n }) => {
                  const tallest = Math.max(1, ...curve.map((c) => c.n));
                  return (
                    <div
                      key={rarity}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <span className="text-[8px] tabular-nums text-muted">
                        {n}
                      </span>
                      <span
                        className="w-full transition-all duration-300"
                        style={{
                          height: `${Math.max(2, (n / tallest) * 40)}px`,
                          background: RARITY[rarity].colour,
                          opacity: n === 0 ? 0.2 : 0.85,
                        }}
                      />
                      <span className="text-[7px] tracking-[0.1em] text-faint">
                        {formatMC(MARKETING_COST[rarity])}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[9px] leading-snug text-muted">
                Your marketing budget grows: {formatMC(RULES.budgetPerTurn)} on
                turn one, {formatMC(RULES.budgetPerTurn * RULES.turns)} on turn
                ten. It does not carry, and what you don't spend comes off your
                market cap. A deck of nothing but expensive cards leaves money
                on the table early; a deck of nothing but cheap ones cannot
                spend it late.
              </p>
            </div>

            {/* Your decks. The four ready-made ones and the random roll used to
                be here, and they went: a player picks between decks they built.
                Handing somebody a deck is also the thing this game decided
                against everywhere else — see the note about the free starter in
                lib/deck-storage.ts. */}
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[9px] tracking-[0.2em] text-faint">YOUR DECKS</p>

              {/* Forty of your own cards, in an order you did not have to click.
                  Not a saved deck and not somebody else's design — it fills the
                  table and then you name it, or press it again. It draws from
                  `pool`, which is what the chain says you hold, so it cannot
                  reach for a card you do not own. */}
              <button
                type="button"
                onClick={rollRandom}
                disabled={(DECK_FROM_COLLECTION ? pool.length : SET.length) < RULES.deckSize}
                className={cx(
                  "mt-2 block w-full border px-2 py-1.5 text-left transition-colors",
                  (DECK_FROM_COLLECTION ? pool.length : SET.length) < RULES.deckSize
                    ? "cursor-not-allowed border-line text-faint"
                    : loaded === "random"
                      ? "border-gold bg-gold/10"
                      : "border-line hover:border-line-strong",
                )}
              >
                <span
                  className={cx(
                    "text-[9px] tracking-[0.16em]",
                    loaded === "random" ? "text-gold" : "text-fg",
                  )}
                >
                  ROLL A RANDOM DECK
                </span>
                <span className="mt-0.5 block text-[9px] leading-snug text-muted">
                  {(DECK_FROM_COLLECTION ? pool.length : SET.length) < RULES.deckSize
                    ? `You hold ${pool.length} cards and a deck is ${RULES.deckSize}.`
                    : "A legal deck out of the cards you hold. Name it below to keep it."}
                </span>
              </button>

              {mine.length === 0 ? (
                <p className="mt-2 text-[9px] leading-snug text-muted">
                  No deck saved yet. Roll one or build one, give it a name below, and it turns up
                  here as the deck you play with.
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  {mine.map((deck) => {
                    const record = records.get(deckKey(deck.cardIds));
                    return (
                      <div
                        key={deck.id}
                        className={cx(
                          "flex items-center gap-1 border transition-colors",
                          loaded === deck.id
                            ? "border-pump bg-pump/10"
                            : "border-line hover:border-line-strong",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => loadSaved(deck)}
                          className="min-w-0 flex-1 px-2 py-1.5 text-left"
                        >
                          <span
                            className={cx(
                              "block truncate text-[9px] tracking-[0.16em]",
                              loaded === deck.id ? "text-pump" : "text-fg",
                            )}
                          >
                            {deck.name}
                          </span>
                          {/* What it has done, not what it is made of. The
                              record is kept by what the deck holds, so it
                              survives a rename — see deckKey. */}
                          <span className="mt-0.5 block text-[9px] leading-snug text-muted">
                            {record === undefined
                              ? "Never played"
                              : `${record.won}W ${record.lost}L${
                                  record.played > 0
                                    ? ` · ${Math.round((record.won / record.played) * 100)}%`
                                    : ""
                                }`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Optimism would be wrong here. The deck lives on
                            // the server, so it is gone when the server says it
                            // is gone — and a row that vanished from the list
                            // and came back on the next load is worse than one
                            // that took a moment to go.
                            void deleteSavedDeck(deck.id).then((gone) => {
                              if (!gone) return;
                              setMine(savedDecks());
                              if (loaded === deck.id) setLoaded(null);
                            });
                          }}
                          title={`Delete ${deck.name}`}
                          className="shrink-0 px-2 py-1.5 text-[9px] text-faint transition-colors hover:text-dump"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-line p-4">
            {/* A name, and then the save. There was no field here at all: the
                builder carried a name, loaded one from storage and picked one
                up from a preset, and nothing let you type it — so every deck
                anybody saved was called whatever a preset had been called, or
                nothing. */}
            <label className="block">
              <span className="text-[9px] tracking-[0.2em] text-faint">NAME</span>
              <input
                value={deckName}
                onChange={(event) => {
                  setDeckName(event.target.value);
                  setSaved(false);
                }}
                maxLength={28}
                placeholder="Name this deck"
                className="mt-1 w-full border border-line bg-ground px-2 py-1.5 text-[11px] text-fg placeholder:text-faint focus:border-pump focus:outline-none"
              />
            </label>

            {/* Why it will not save, in the words the rules use. The button
                being grey was the whole explanation before, and the commonest
                reason for it — not enough cards — is one somebody can fix. */}
            {!legal && picked.length > 0 && (
              <p className="mt-2 text-[9px] leading-snug text-gold">{problems[0]}</p>
            )}
            {saveFailed.length > 0 && (
              <p className="mt-2 text-[9px] leading-snug text-dump">{saveFailed[0]}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!legal || saving}
                onClick={save}
                className={cx(
                  "flex-1 border px-3 py-2 text-[9px] tracking-[0.18em] transition-colors",
                  legal
                    ? "glow-pump border-pump bg-pump/10 text-pump hover:bg-pump hover:text-ground"
                    : "cursor-not-allowed border-line-strong text-faint",
                )}
              >
                {saving ? "SAVING…" : saved ? "SAVED" : "SAVE DECK"}
              </button>
              <button
                type="button"
                onClick={clear}
                className="border border-line-strong px-3 py-2 text-[9px] tracking-[0.16em] text-muted hover:border-dump hover:text-dump"
              >
                CLEAR
              </button>
            </div>

            {problems.length > 0 && (
              <ul className="mt-3 space-y-1">
                {problems.map((problem) => (
                  <li
                    key={problem}
                    className="text-[10px] leading-relaxed text-dump"
                  >
                    {problem}
                  </li>
                ))}
              </ul>
            )}

            {initial.rejected.length > 0 && (
              <p className="mt-3 text-[10px] leading-relaxed text-gold">
                Your saved deck is not legal any more, so nothing is loaded.{" "}
                {initial.rejected[0]}
              </p>
            )}
          </div>

          <div className="hidden">
            {picked.length === 0 ? (
              <p className="px-1 py-6 text-center text-[10px] text-faint">
                Nothing picked yet. Click a card to add it.
              </p>
            ) : (
              <ol className="space-y-1">
                {[...picked]
                  .map((id) => INDEX.get(id))
                  .filter((c): c is Card => Boolean(c))
                  .sort(
                    (a, b) =>
                      MARKETING_COST[b.rarity] - MARKETING_COST[a.rarity] ||
                      a.name.localeCompare(b.name),
                  )
                  .map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() => toggle(card)}
                        title={`Remove ${card.name}`}
                        className="flex w-full items-center gap-2 border-l-2 px-2 py-1 text-left text-[10px] transition-colors hover:bg-panel-raised"
                        style={{ borderColor: RARITY[card.rarity].colour }}
                      >
                        <span className="flex-1 truncate text-fg">
                          {card.name}
                        </span>
                        <span className="shrink-0 text-[8px] tracking-[0.12em] text-faint">
                          {TYPE_LABEL[card.type].slice(0, 4)}
                        </span>
                        <span className="shrink-0 tabular-nums text-gold">
                          {formatMC(MARKETING_COST[card.rarity])}
                        </span>
                      </button>
                    </li>
                  ))}
              </ol>
            )}
          </div>
        </div>
      </aside>

      {/* Phones only, and it exists because the panel cannot be in two places.
          The panel is at the top now, which fixes starting a deck; this fixes
          finishing one, so the count and the save are reachable from anywhere
          in the list without scrolling back up. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "display shrink-0 text-base",
              picked.length === RULES.deckSize ? "text-pump" : "text-fg",
            )}
          >
            {picked.length}
            <span className="text-xs text-faint">/{RULES.deckSize}</span>
          </span>

          {/* Why it will not save, in the one place the button is. Without this
              a disabled button on a phone is a dead end: the reasons are up in
              the panel and the panel is a screen away. */}
          <span className="min-w-0 flex-1 truncate text-[9px] leading-tight text-muted">
            {saveFailed.length > 0
              ? saveFailed[0]
              : saving
                ? "Saving…"
                : legal
                  ? saved
                    ? "Saved."
                    : deckName.trim() === ""
                      ? "Ready. It will be named for you."
                      : `Ready to save “${deckName.trim()}”.`
                  : picked.length === 0
                    ? "Pick cards, or roll a deck at the top."
                    : problems[0]}
          </span>

          <button
            type="button"
            onClick={clear}
            className="shrink-0 border border-line-strong px-2.5 py-1.5 text-[9px] tracking-[0.16em] text-muted"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={!legal || saving}
            onClick={save}
            className={cx(
              "shrink-0 border px-3 py-1.5 text-[9px] tracking-[0.18em]",
              legal && !saving
                ? "border-pump bg-pump/10 text-pump"
                : "cursor-not-allowed border-line-strong text-faint",
            )}
          >
            {saving ? "…" : saved ? "SAVED" : "SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised: toggling one card re-renders the summary, and without this every one
 * of the cards in the set would redraw its chart along with it.
 */
const PickableCard = memo(function PickableCard({
  card,
  chosen,
  blocked,
  owned,
  held,
  compact,
  onToggle,
}: {
  card: Card;
  chosen: boolean;
  blocked: string | null;
  owned: boolean;
  held: number;
  compact: boolean;
  onToggle: (card: Card) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(card)}
      disabled={!chosen && blocked !== null}
      title={blocked ?? (chosen ? `Remove ${card.name}` : `Add ${card.name}`)}
      className={cx(
        "relative text-left transition-opacity",
        chosen
          ? "cursor-pointer"
          : blocked
            ? "cursor-not-allowed opacity-35"
            : "cursor-pointer",
      )}
    >
      <CardView
        card={card}
        compact={compact}
        className={cx(chosen && "ring-2 ring-pump")}
      />

      {/* Only when it is in the deck. It used to print the card's price when it
          was not, which the card already prints itself in the corner of its own
          art — two of the same number, and the duplicate sat on top of the
          rarity label and hid it. */}
      {/* Bottom right, both of them. Top right is where the card prints its own
          rarity, and a badge there covers it — which is the second time a badge
          in this component has hidden something the card was already saying. */}
      {chosen ? (
        <span className="absolute right-3 bottom-3 z-20 flex items-center gap-1 border border-pump bg-pump px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-ground">
          <Icon name="mc" className="h-2.5 w-2.5" />
          IN DECK
        </span>
      ) : (
        // Only ever above one. A deck takes one of each however many you hold,
        // so this is not a number you can spend here — it is what you have to
        // trade, and the only place the interface admits duplicates exist.
        held > 1 && (
          <span className="absolute right-3 bottom-3 z-20 border border-line-strong bg-ground/85 px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-gold tabular-nums">
            ×{held}
          </span>
        )
      )}
    </button>
  );
});

function Bar({
  value,
  tone,
}: {
  value: number;
  tone: "pump" | "gold" | "dump";
}) {
  const colour = { pump: "bg-pump", gold: "bg-gold", dump: "bg-dump" }[tone];
  return (
    <div className="mt-1.5 h-[3px] w-full bg-line">
      <div
        className={cx("h-full transition-all duration-300", colour)}
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-[9px] tracking-[0.16em] text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  colour,
  onClick,
  children,
}: {
  active: boolean;
  colour?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "border px-2 py-1 text-[9px] tracking-[0.12em] transition-colors",
        active
          ? "text-ground"
          : "border-line text-muted hover:border-line-strong hover:text-fg",
      )}
      style={
        active
          ? {
              background: colour ?? "#e8eaed",
              borderColor: colour ?? "#e8eaed",
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
