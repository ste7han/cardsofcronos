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
| Supply | **1894**, token ids **1…1894** |
| `baseURI` | `ipfs://bafybeiesdbbbke64a3afo2qp6ttwjgq3bhbvrtcvajb4ct2oujc7totu2m/` |
| `tokenURI(n)` | `baseURI + n + ".json"` |
| `mintPrice` | `150 ether` — 150 CRO |
| `MAX_MINT_PER_TX` | 50 |
| Mint gate | `isMintPaused`, and `saleStartTimestamp` |

Despite the ABI file being called `ERC721A.JSON`, this is **not** ERC721A. The
source says `contract CardsOfCronos is ERC721, ERC721Enumerable, Ownable`. The
file name is wrong and has been since it was written; the contract is what it is.

Source and ABI are kept in `contracts/`.

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

## Deriving the holders

There is **no stored snapshot anywhere**. The old dapp derived ownership live,
per wallet, on every visit to the arena, and threw the answer away.

The method it used is the right one and takes four round trips for the whole
collection:

- **Multicall3** at `0xcA11bde05977b3631167028862bE2a173976CA11` (the standard
  address, same on Cronos as everywhere else).
- `tryAggregate(false, calls)` over `ownerOf(1..1894)` in **batches of 500**.
- `requireSuccess = false` matters: a burned token makes `ownerOf` revert, and
  with `true` one burned token takes the whole batch of five hundred with it.
- A call that fails, or whose result will not decode, is a token that is not
  owned rather than an error to raise.

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

**What the snapshot needs that the old code did not do.** The old route answered
"which of these does *this wallet* own". The airdrop needs the inverse — every
owner, once — which is the same four calls with the results inverted into
`address → [tokenIds]` instead of filtered by one address. Run it **once**,
write the result down, and treat that file as the record. A snapshot that is
re-derived later is a snapshot taken at a different moment.

---

## Which token is which card

`data/legacy-token-mapping.json`, moved out of `src/lib/token_mapping.json`.

1894 token ids → 235 distinct card ids. Between 1 and 15 copies of a card, about
8 on average.

### One thing to check before minting anything

Tokens **215**, **1250** and **1814** all map to `COC_Howlers_Founder_L1`. That
card id was renamed: it used to be `COC_Howlers_FounderL1`, without the
underscore, and those three rows were rewritten to match.

The mapping file is right. **The on-chain IPFS metadata was never checked**, and
it sits behind a `baseURI` this repo does not control. If the JSON at
`ipfs://…/215.json` still says the old name, that is three tokens whose metadata
disagrees with everything else — worth looking at before the free mints go out,
because that is exactly the sort of thing that surfaces as one confused holder
and no way to explain it.

---

## The art

`public/NFTCARDS/` — 236 PNGs, about 3 MB each, **734 MB in total**. 235 of them
match a card id one for one; `mystery.png` is the placeholder and is zero bytes.

Untracked, and gitignored on purpose. It was one `git add .` away from being in
the history forever, which is the reason the ignore rule is written the way it
is.

This art belongs to the collection above and stays with it. The new line gets
new illustrations — that was settled at the start of the rebuild.
