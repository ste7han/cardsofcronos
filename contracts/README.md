# The deployed contract

`CardsOfCronos.sol` and its ABI, as deployed at
`0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902` on Cronos.

Moved here out of `public/`, where the old dapp both stored it and served it —
the browser fetched `/ERC721A.JSON` at runtime to get the ABI. Nothing in this
codebase does that, and a contract source is not a public asset.

The file name says ERC721A and the contract does not: the source reads
`contract CardsOfCronos is ERC721, ERC721Enumerable, Ownable`. The ABI was
renamed to match the contract rather than the mistake.

Everything worth knowing about it is written down in `docs/the-first-collection.md`.
This is the starting point for the new line's contract — the $CROCARD discount
in particular is worth keeping.
