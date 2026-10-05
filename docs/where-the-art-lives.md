# Where the art and the metadata live

The collection's `tokenURI` is an IPFS folder CID plus the token id. Which folder
is a decision that was made on Filebase, in a bucket, by a person — and none of
the bucket names were written down anywhere. Finding them again on 29 September
2026 meant asking Filebase for a list, which is a thing that works right up until
the day the key is rotated or somebody else has to do it.

So: this is the list.

## The buckets

| bucket | what is in it |
|---|---|
| `coc-facedown-v2` | **The live metadata.** One file per token, no extension, named `1` … `5603`. This is the folder the contract points at, and it is the folder `scripts/nft/reveal.ts` writes into. |
| `coc-meta-v2` | The revealed metadata for every token, written by `scripts/nft/tokens.ts`. It is the source a reveal copies from; the contract has never pointed at it. |
| `coc-back-v2` | `back.webp` — the card back, which every face-down token's `image` points at. |
| `coc-facedown` | The first version of the same, against an older card back. Nothing points at it. |
| `coc-meta` | The first version of the revealed metadata, against older renders. Nothing points at it. |

The `crooks-*` buckets in the same account belong to Crooks Finance and have
nothing to do with this project.

## Why the live folder is the face-down one

It reads backwards and it is the point. A reveal does not switch the contract
from one folder to another — it writes the revealed files **into** the folder the
contract already points at, as far as the mint has got, and leaves the rest face
down. That is what makes a partial reveal possible: one folder holding 1,325 real
cards and 4,278 backs.

Filebase gives that folder a new CID every time its contents change, and IPFS
CIDs are immutable — so the old CID keeps serving the old contents until
`setBaseURI` is called. Nothing changes for anybody until it is.

## Doing a reveal

```
npm run reveal -- coc-facedown-v2 --contract 0xe08c69c02d7f9a695466741f9f83391167db3da1
npm run base-uri -- ipfs://<the CID it printed>/ --broadcast
```

The first reads `nextTokenId` from the chain and turns everything below it face
up. The second checks the boundary from the outside — the last sold token must be
face up, the first unsold one face down — and refuses to send if it is not.

Both are safe to run again. A reveal that is interrupted can be re-run; a base
URI that is already set is refused rather than paid for.

## What is not here

`FILEBASE_KEY` and `FILEBASE_SECRET`, which live in `.env.local` and are read
through `--env-file`. They are never passed as arguments: argv is visible to
anybody who can run `ps`.

## History

- **17 September 2026** — art and metadata first uploaded (`45ddf5e`).
- **29 September 2026** — first reveal, tokens 1…1325, CID
  `bafybeicwugnskyf5ehtwjjhs3xxaowppncieydnkrbvhm4ur4su35vlp2y`, set on chain in
  `0xc071d1c05b8ff6afcfe5e8dd8cab3aab8bc224ec87146ef7710580cc7cac555f`.
- **5 October 2026** — second reveal, tokens 1…1629 (304 more), 3974 still face
  down, CID `bafybeib4jpmokgckhq3fbd46fwfkdchqtye3us4j6nhmavsev5pkuxz7d4`, set on
  chain in
  `0x5a14a140a674435bc307f410f106b75fc16f56fe243e7789d35f658809d6b353`. The
  boundary was read back from the new folder through an independent gateway
  before and after: 1629 face up, 1630 the card back.

## It needs doing again

Every hundred cards sold is a hundred owners looking at a card back. There is
nothing automatic about it — `nextTokenId` moving is the only signal, and nothing
watches that — so the two commands above are a thing somebody has to remember.
The CID has to be carried by hand from the first to the second, which is exactly
where a typo goes.
