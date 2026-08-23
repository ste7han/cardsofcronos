import { CardView } from "@/components/CardView";
import type { Card } from "@/engine/types";
import { cx } from "@/lib/cx";

/**
 * Three cards fanned out next to the title. A card game's landing page that shows
 * no cards is asking the visitor to take it on faith that they're any good.
 */
/**
 * The fan. x pushes the outer two away from the middle rather than pulling them
 * under it — they used to sit at +14 and -14, leaning inwards, and between that
 * and the overlap the centre card covered both of their art windows. Three cards
 * whose pictures you cannot see is a worse advert than two.
 */
const POSE = [
  { rotate: -9, y: 26, x: -20, scale: 0.9, z: 0 },
  { rotate: 0, y: 0, x: 0, scale: 1, z: 20 },
  { rotate: 9, y: 26, x: 20, scale: 0.9, z: 10 },
];

export function HeroCards({ cards }: { cards: Card[] }) {
  return (
    // Scaled down: at full size the cards run off screen, and a clipped card reads
    // as broken rather than fanned out.
    //
    // The step up happens at 1360 rather than at Tailwind's xl, which is exactly
    // 1280 — the width where the fan was pushing the page four pixels wide and
    // giving the whole landing page a horizontal scrollbar. At 1280 the larger
    // treatment was already switched on with no room for it.
    //
    // Checked at 768, 1024, 1100, 1280, 1360, 1440 and 1920: scrollWidth equals
    // clientWidth at every one. Worth re-checking after any change here, because
    // the cards sit in slots narrower than they are and layout cannot see the
    // overhang.
    <div className="relative flex origin-center scale-[0.72] items-start justify-center xl:scale-[0.82]">
      {/* Glow behind the fan, so the cards don't float in black. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
        style={{
          background:
            "radial-gradient(20rem 18rem at 50% 45%, rgba(0,224,138,0.16), transparent 70%), radial-gradient(16rem 14rem at 70% 70%, rgba(245,196,81,0.12), transparent 70%)",
        }}
      />

      {cards.slice(0, 3).map((card, i) => {
        const p = POSE[i]!;
        return (
          <div
            key={card.id}
            className={cx("w-[172px] shrink-0", i > 0 && "-ml-4")}
            style={{
              transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg) scale(${p.scale})`,
              zIndex: p.z,
            }}
          >
            <CardView card={card} className="w-[300px]" />
          </div>
        );
      })}
    </div>
  );
}
