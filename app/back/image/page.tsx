// The card back, as a file.
//
// The same shot as /card/<id>/image and for the same reason: there is one
// component that decides what a back looks like, and the picture somebody holds
// before the reveal has to be that component rather than a drawing of it.
//
// What it is for: every token carries this image until the mint closes. Pointing
// the contract at the real metadata before then would let anybody read ahead and
// buy only the good ones — see scripts/nft/placeholder.ts.

import type { Metadata } from "next";

import { CardBack } from "@/components/CardBack";

export const metadata: Metadata = {
  title: "Card back — Cards of Cronos",
  robots: { index: false, follow: false },
};

export default function CardBackImagePage() {
  return (
    <div
      // No page furniture, no grid lines, no margin: the screenshot is this
      // element and nothing else.
      id="card-image"
      // The same shape as the front, which is 5:7.8 at full size and not the 5:7
      // a playing card usually is — see the note on the frame in CardView. A back
      // that is shorter than its front is two different cards in one wallet.
      className="aspect-[5/7.8] w-[268px] bg-ground"
    >
      <CardBack size="large" />
    </div>
  );
}
