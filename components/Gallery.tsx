"use client";

import { useEffect, useMemo, useState } from "react";

import { CardSizePicker } from "@/components/CardSizePicker";
import { sizeOf, useCardSize } from "@/lib/card-size";
import { CardView } from "@/components/CardView";
import { cardLabel, searchText } from "@/engine/format";
import type { Card, CardType, Rarity, Sector } from "@/engine/types";
import { CARD_TYPES, RARITIES, SECTORS } from "@/engine/types";
import { cx } from "@/lib/cx";
import { RARITY, SECTOR_LABEL, TYPE_LABEL } from "@/lib/rarity";


export function Gallery({ cards }: { cards: readonly Card[] }) {
  const [type, setType] = useState<CardType | null>(null);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [search, setSearch] = useState("");
  /** The card being looked at up close, or none. */
  const [open, setOpen] = useState<Card | null>(null);
  const [size, setSize] = useCardSize();
  const step = sizeOf(size);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (type && card.type !== type) return false;
      if (rarity && card.rarity !== rarity) return false;
      if (sector && (card.type !== "project" || card.sector !== sector)) return false;
      if (term && !searchText(card).includes(term)) return false;
      return true;
    });
  }, [cards, type, rarity, sector, search]);

  const anyFilter = type !== null || rarity !== null || sector !== null || search !== "";

  return (
    <div className="space-y-6">
      <div className="panel space-y-3 border border-line p-4">
        <Row label="TYPE">
          {CARD_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>
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
              {RARITY[r].label}
            </Chip>
          ))}
        </Row>

        <Row label="SECTOR">
          {SECTORS.map((s) => (
            <Chip key={s} active={sector === s} onClick={() => setSector(sector === s ? null : s)}>
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
          <span className="text-[10px] tracking-[0.14em] text-muted">
            {visible.length} / {cards.length}
          </span>
          <CardSizePicker size={size} onPick={setSize} />
          {anyFilter && (
            <button
              type="button"
              onClick={() => {
                setType(null);
                setRarity(null);
                setSector(null);
                setSearch("");
              }}
              className="border border-line-strong px-2.5 py-1.5 text-[10px] tracking-[0.14em] text-muted hover:border-dump hover:text-dump"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="panel border border-line px-4 py-10 text-center text-[11px] text-muted">
          No card matches that. This set has {cards.length} of them.
        </p>
      ) : (
        // Sized rather than counted — see the note in DeckBuilder. The floor
        // comes from the size picker, and each step carries the card face that
        // is honest at that width.
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${step.min}px), 1fr))`,
          }}
        >
          {visible.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setOpen(card)}
              aria-label={`Look at ${cardLabel(card)} up close`}
              className="block w-full cursor-zoom-in text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-pump"
            >
              <CardView card={card} compact={step.compact} />
            </button>
          ))}
        </div>
      )}

      {open !== null && <CloseUp card={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * One card, big, with the file behind it.
 *
 * The close-up is the easy half. The half worth building is the link under it:
 * the picture is composed here out of HTML — a frame, an art window, a footer of
 * stats — so there was no such thing as "the card as an image", and anybody who
 * wanted to post their card somewhere had to screenshot it and crop.
 *
 * public/render holds the real file, 1072x1676, and it is the same picture the
 * NFT uses rather than a second drawing of one: scripts/render-cards.ts
 * screenshots /card/<id>/image, which renders this same CardView. So what
 * somebody saves and posts is what they hold.
 */
function CloseUp({ card, onClose }: { card: Card; onClose: () => void }) {
  // Escape closes it, the way every other overlay in this project does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={cardLabel(card)}
    >
      <div
        className="w-[min(360px,calc(100vw-2rem))]"
        // Clicking the card should not close it. Only the ground around it.
        onClick={(event) => event.stopPropagation()}
      >
        <CardView card={card} />

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {/* `download` rather than a plain link, so it saves instead of
              opening — the difference between "here is the file" and "here is
              a tab you now have to right-click". */}
          <a
            href={`/render/${card.id}.webp`}
            download={`${card.id}.webp`}
            onClick={(event) => event.stopPropagation()}
            className="glow-pump border border-pump bg-pump/10 px-4 py-2 text-[10px] tracking-[0.18em] text-pump transition-colors hover:bg-pump hover:text-ground"
          >
            SAVE THE IMAGE
          </a>
          <a
            href={`/render/${card.id}.webp`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="border border-line-strong px-4 py-2 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            OPEN IT
          </a>
        </div>

        <p className="mt-2 text-center text-[9px] leading-relaxed text-faint">
          1072 × 1676, the same picture the NFT uses. Click anywhere or press Esc to close.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-[9px] tracking-[0.16em] text-muted">{label}</span>
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
        active ? "text-ground" : "border-line text-muted hover:border-line-strong hover:text-fg",
      )}
      style={active ? { background: colour ?? "#e8eaed", borderColor: colour ?? "#e8eaed" } : undefined}
    >
      {children}
    </button>
  );
}
