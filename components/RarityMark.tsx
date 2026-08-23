// The rarity, as a mark.
//
// Pokémon puts a circle, a diamond or a star in the corner, and it works because
// you learn it in one sitting and then never read the word again. Five tiers
// need five shapes that are told apart at eight pixels, which rules out anything
// with detail in it: the difference has to be in the silhouette.
//
// So the count of points goes up with the tier — none, four, five, six, and then
// a mythic that is the legendary star with a ring around it. Filled throughout,
// because an outline at this size is a smudge.

import type { Rarity } from "@/engine/types";

/** A star of `points`, as an SVG path on a 24-unit square. */
function star(points: number, inner = 0.42): string {
  const steps = Array.from({ length: points * 2 }, (_, i) => {
    const radius = (i % 2 === 0 ? 1 : inner) * 11;
    // Starting at the top rather than at three o'clock, so every mark stands up.
    const angle = (Math.PI * i) / points - Math.PI / 2;
    return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${steps.join("L")}Z`;
}

const SHAPES: Record<Rarity, { path: string; ring?: boolean }> = {
  common: { path: "M12 5.5A6.5 6.5 0 1 1 12 18.5A6.5 6.5 0 1 1 12 5.5Z" },
  rare: { path: "M12 1.5L22.5 12L12 22.5L1.5 12Z" },
  epic: { path: star(5, 0.5) },
  legendary: { path: star(6, 0.46) },
  mythic: { path: star(8, 0.42), ring: true },
};

export function RarityMark({
  rarity,
  className,
  colour,
}: {
  rarity: Rarity;
  className?: string;
  colour: string;
}) {
  const shape = SHAPES[rarity];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill={colour}>
      {shape.ring && (
        <circle cx="12" cy="12" r="11" fill="none" stroke={colour} strokeWidth="1.6" />
      )}
      <path d={shape.path} />
    </svg>
  );
}
