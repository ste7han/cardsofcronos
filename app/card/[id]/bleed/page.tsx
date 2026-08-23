// The same card in the alternative frame, so the two can be compared as files.
// Nothing in the game points here; it exists to be looked at and chosen between.

import { notFound } from "next/navigation";

import { CardViewBleed } from "@/components/CardViewBleed";
import { SET } from "@/lib/set";

export const dynamicParams = false;

export function generateStaticParams() {
  return SET.map((card) => ({ id: card.id }));
}

export default async function CardBleed({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = SET.find((c) => c.id === id);
  if (!card) notFound();

  return (
    <div id="card-image" className="w-[268px] bg-ground">
      <CardViewBleed card={card} />
    </div>
  );
}
