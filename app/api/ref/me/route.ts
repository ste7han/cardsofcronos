// Your referral code, and who you have brought.
//
// The code is made on first ask rather than at sign-up, because there is no
// sign-up: a player exists the first time they prove a wallet, and giving every
// wallet a code at that moment would fill the table with codes for people who
// only ever looked at the cards page.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { ensureRefCode, playerOf, referralsBy, referrerOf } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const code = await ensureRefCode(db(), wallet);
  const [brought, broughtBy, player] = await Promise.all([
    referralsBy(db(), wallet),
    referrerOf(db(), wallet),
    playerOf(db(), wallet),
  ]);

  return Response.json({
    code,
    record: { wins: player.wins, losses: player.losses, draws: player.draws },
    // Addresses and nothing else. Whether somebody linked an X account is their
    // business, and a referral list that named handles would be a list of who
    // knows whom.
    brought: brought.map((referral) => ({
      wallet: referral.referee,
      claimedAt: referral.claimedAt,
    })),
    broughtBy: broughtBy ? { code: broughtBy.code } : null,
  });
}
