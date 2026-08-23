// One card, alone on the page, at the size it was designed at.
//
// This is what becomes the NFT image. It renders the same CardView the game
// renders — deliberately, and it is the whole point of the route. A separate
// drawing program for the mint would be a second implementation of what a card
// looks like, and the day the two disagree the picture somebody owns stops
// matching the card they are playing. There is one renderer.
//
// The card comes out at its natural 268x375. Scaling up happens at capture
// time, through the browser's device pixel ratio, so the output is crisp rather
// than a transformed and resampled copy of a small one.

import { notFound } from "next/navigation";

import { CardView } from "@/components/CardView";
import { SET } from "@/lib/set";

export const dynamicParams = false;

export function generateStaticParams() {
  return SET.map((card) => ({ id: card.id }));
}

export default async function CardImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = SET.find((c) => c.id === id);
  if (!card) notFound();

  return (
    <div
      // No page furniture, no grid lines, no margin: the screenshot is this
      // element and nothing else, so whatever is around it would end up baked
      // into the picture.
      id="card-image"
      className="w-[268px] bg-ground"
    >
      <CardView card={card} />
    </div>
  );
}
