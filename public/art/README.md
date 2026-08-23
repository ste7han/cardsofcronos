# Card art

Drop an image here and point a card at it:

```ts
{ id: "wif", ..., art: "/art/wif.png" }
```

The window is landscape, roughly 16:9, and the image is cropped to fill it
(`object-cover`), so anything important belongs in the middle — the sides get
trimmed on the small card in your hand, which is a wider crop than the large one.

Nothing else changes. A card with no `art` keeps its generated candle chart, so
the set can be half real and half placeholder without looking broken.

Keep the files out of the repo once there are more than a handful: the previous
project's art was 734 MB and sat untracked, which works right up until someone
runs `git add .`. `art` is a URL, so it can point at storage with a CDN.
