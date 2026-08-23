# The first collection

Everything about the NFTs that already exist, written down because the code it
was read out of is being deleted and the facts are not.

The people holding these get a free mint of the new line. That is the whole
reason this file exists: the snapshot has to be taken against the collection as
it actually is, and none of what follows can be reconstructed from the new
codebase.

Verified against `public/contract.sol` and `src/app/api/scan/route.ts` on
2026-08-23, immediately before both were removed from this branch. Both still
exist on `fix/battle-system` and in the history.

---

## The contract

| | |
|---|---|
| Address | `0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902` |
| Chain | Cronos mainnet, chainId **25** |
| Name / symbol | `Cards of Cronos` / `COC` |
| Standard | OpenZeppelin **ERC721 + ERC721Enumerable + Ownable** |
| Ever minted | **515**, token ids **1…515** — see below |
| Alive now | **515**. `totalSupply()` agrees. |
| `baseURI` | `ipfs://bafybeiesdbbbke64a3afo2qp6ttwjgq3bhbvrtcvajb4ct2oujc7totu2m/` |
| `tokenURI(n)` | `baseURI + n + ".json"` |
| `mintPrice` | `150 ether` — 150 CRO |
| `MAX_MINT_PER_TX` | 50 |
| Mint gate | `isMintPaused`, and `saleStartTimestamp` |

Despite the ABI file being called `ERC721A.JSON`, this is **not** ERC721A. The
source says `contract CardsOfCronos is ERC721, ERC721Enumerable, Ownable`. The
file name is wrong and has been since it was written; the contract is what it is.

Source and ABI are kept in `contracts/`.

### It is a quarter of the size everybody wrote down

`COLLECTION_SIZE = 1894` was in the old dapp, and `data/legacy-token-mapping.json`
has 1894 rows. **1894 was the plan.** The mint stopped at 515.

`nextTokenId()` returns 516 and `totalSupply()` returns 515. Ids 516 to 1894 were
never minted, so `ownerOf` on any of them reverts — which is exactly what the
first run of `scripts/holders.ts` saw, and it reported the whole collection as
burned. The script reads the size off the contract now and cross-checks its own
count against `totalSupply()`.

Anything that says 1894 is describing a spreadsheet. The chain says 515.

### The $CROCARD discount

```solidity
function getDiscountRate(address user) public view returns (uint256) {
    uint256 balance = discountToken.balanceOf(user);
    uint256 discount = balance / 1_000_000e18;   // one percent per million
    if (discount > 30) discount = 30;            // capped at thirty
    return discount;
}
```

`discountToken` is `$CROCARD` at `0xECf3361441512c1e9F6A6e8734D86614D8e795BC`,
which is the same token `lib/revenue.ts` burns. Worth keeping in the new
contract: it is the one mechanic that already rewards holding the token.

Note the precision: an integer division by `1_000_000e18` means anything under a
million tokens rounds to no discount at all.

---

## The holders

`data/holders-snapshot.json`, taken at block 89737757 on
2026-08-23. Rerun with `npx tsx scripts/holders.ts`.

| | |
|---|---|
| Tokens | **515** |
| Holders | **50** |
| At the burn address | **10** |
| Largest holder | **63** tokens |

Fifty addresses, and one of them is not a person: 10 tokens
sit at `0x42BCc1355808aDf2344773c54e364257911CcC99`, the old dapp's burn address.
The contract calls it an owner. An allowlist should not. That is a decision to
make before the tree is built rather than after somebody notices.

The old dapp derived ownership live, per wallet, on every visit to the arena,
and threw the answer away. There was **no stored snapshot anywhere** until this
one.

It reached for **Multicall3** at `0xcA11bde05977b3631167028862bE2a173976CA11`
(the standard address, same on Cronos as everywhere else) and put five hundred
`ownerOf` calls inside one `eth_call` with `tryAggregate(false, calls)`. The
`false` matters: with `requireSuccess = true` one reverting token takes the whole
batch of five hundred with it.

That was the right instinct and for a reason that is not obvious — see the batch
size note below.

**RPC failover, in order.** Cronos' public endpoints go down often enough that
one is not a plan, and the old code carried a scar about it: a BlockPI URL with
its API key in the repo, out of quota, returning HTTP 402 — which ethers turned
into a misleading "transaction reverted" and the UI showed as "Server Scan
Error". The list, after that:

```
process.env.CRONOS_RPC_URL        (a paid endpoint, if there is one)
https://evm.cronos.org
https://cronos-evm-rpc.publicnode.com
https://cronos.drpc.org
https://evm-cronos.crypto.org
```

`lib/cronos.ts` carries the first four of these already.

**Two things the first attempt got wrong**, both worth keeping written down.

*Batch size.* `evm.cronos.org` refuses a JSON-RPC batch over ten calls:
`-32600 request exceeded maximum batch size(10), got 500`. This is why the old
dapp used Multicall3 — five hundred calls inside one `eth_call` is not a batch
and the limit does not apply. `scripts/holders.ts` uses batches of ten instead,
a few in flight, which is a fair trade for a script that runs once.

*A revert and a refusal are not the same error.* The first version treated every
error entry as "this token has no owner", so a refused batch read as a burned
token — and it reported all 1894 as burned with no holders at all. Only an
execution revert means no owner now; anything else fails the endpoint out loud.

**Run it once.** A snapshot re-derived later is a snapshot of a different moment,
and somebody who sold in between was promised a mint and will not get one.

---

## Which token is which card

`data/legacy-token-mapping.json`, moved out of `src/lib/token_mapping.json`.

It has 1894 rows because 1894 was the plan. All 515 minted tokens are in it, and
between them they cover **194 of the 235 cards** — the other 41 were never
minted at all. The commonest card in the collection is `COC_EVT_Boost_of_Faith`,
at nine copies.

### One token to check before minting anything

Tokens 215, 1250 and 1814 all map to `COC_Howlers_Founder_L1`. That card id was
renamed — it used to be `COC_Howlers_FounderL1`, without the underscore — and
those three rows were rewritten to match.

**Only token 215 exists.** 1250 and 1814 are past 515 and were never minted, so
this is one token rather than three.

The mapping file is right. **The on-chain IPFS metadata was never checked**, and
it sits behind a `baseURI` this repo does not control. If the JSON at
`ipfs://…/215.json` still says the old name, that is one token whose metadata
disagrees with everything else. One is cheap to look at and cheap to fix; it is
still worth doing before the free mints, because it is exactly the sort of thing
that surfaces later as a confused holder and no way to explain it.

---

## How many free mints, either way

Both policies are cheap to compute from the snapshot and the mapping, and they
turn out to be close together:

| Policy | Mints |
|---|---|
| One per token held | **515** |
| One per distinct card held | **487** |

Twenty-eight apart. The largest holder has 63 tokens covering 59 different
cards; the difference is entirely people who hold two copies of something.

The allowlist is built with a **quantity per address**, so this is a flag on
`scripts/allowlist.ts` rather than a property of the contract. It does not have
to be settled before the contract is written.

What does have to be settled is the burn address: 10 of those tokens sit at
`0x42BCc1355808aDf2344773c54e364257911CcC99` and there is nobody behind it.

---

## The art

`public/NFTCARDS/` — 236 PNGs, about 3 MB each, **734 MB in total**. 235 of them
match a card id one for one; `mystery.png` is the placeholder and is zero bytes.

Untracked, and gitignored on purpose. It was one `git add .` away from being in
the history forever, which is the reason the ignore rule is written the way it
is.

This art belongs to the collection above and stays with it. The new line gets
new illustrations — that was settled at the start of the rebuild.
