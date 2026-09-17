# Landing page enhancement — design

Date: 2026-09-17
Status: approved, not yet implemented

## Problem

The landing page (`src/app/page.tsx`) is information-thin and has no imagery.

- The only visual is a plain list card in the hero.
- Sectors render as bare text links.
- Featured-launch cards show name, symbol and progress, discarding the taken-in
  amount, pairing and age that `listLaunches` already fetches.
- Nothing on the page states the scale of the protocol.

The obvious fix — luxury photography — is closed off twice over. `page.tsx`
already records the decision ("Product UI as the hero visual — not stock
supercar photography"), and the eleven luxury houses that carry the narrative
(Ferrari, LVMH, Hermès, Kering, Richemont, Moncler, Porsche, Burberry, Prada,
Swatch, Estée Lauder) have no logo, no asset and no price. Using their real
marks would imply an endorsement that does not exist.

Measured state: all 194 registry assets expose a `logoUrl` on
`cdn.robinhood.com`, so the seven companies with a tokenized asset already show
a real mark. The other eleven fall back to a letter monogram.

## Approach

Original abstract imagery, generated for this project, used as structural
punctuation rather than wallpaper. No brand marks, no products, no logos, so
nothing implies endorsement and no trademark is used.

Rejected alternatives:

- **Full-bleed gallery.** Conflicts with the restraint brief in `globals.css`
  ("No neon, no glow, no glassmorphism") and reads as a generic crypto page.
- **Typographic only.** Zero risk but does not meet the goal of adding imagery.
- **Real brand logos and photography.** Strongest visually, but uses trademarked
  marks without licence and implies endorsement.

## Imagery

Eight images in `public/textures/`, rendered through `next/image`. Local files,
so Next optimises them — unlike the remote CDN logos, which require
`unoptimized` because `next.config.ts` declares no `images.remotePatterns`.

Each is keyed to the existing tokens: ground `#f4f0e8`, ink `#11100f`, gold
`#b99a62`, champagne `#d8c5a0`.

| File | Use | Subject |
| --- | --- | --- |
| `hero.webp` | Hero, closing CTA | Layered silk, gold leaf and stone; macro; portrait |
| `fashion.webp` | Fashion Houses | Folded silk, fine weave |
| `automotive.webp` | Supercars & Motoring | Brushed aluminium, carbon grain |
| `watches.webp` | Watches | Guilloché engraving, concentric machining |
| `materials.webp` | Precious Materials | Gold leaf on pale stone |
| `conglomerate.webp` | Luxury Conglomerates | Veined marble |
| `beauty.webp` | Premium Beauty | Soft cream and powder swirl |
| `hospitality.webp` | Hospitality | Travertine in warm light |

Seven sectors are represented by live data (fashion 5, automotive 4, watches 2,
materials 2, conglomerate 2, beauty 2, hospitality 1). `jewelry`, `consumer` and
`other` carry no companies and get no texture; the sector grid is built from
sectors that actually have markets, so an unused texture is never requested.

Images are decorative. Each carries `alt=""` and is hidden from assistive
technology; no information exists only inside an image.

## Page structure

Top to bottom, with changes marked:

1. **Hero** — *changed.* Keeps the two-column split and the existing "Verified
   launch pairs" card. The right column becomes `hero.webp` with that card
   overlapping its lower edge, preserving the product-UI-as-hero decision while
   giving the page an image.
2. **Stats band** — *new.* Full-width strip beneath the hero. See Data below.
3. **Markets** — unchanged.
4. **How it works** — unchanged. Explicitly out of scope.
5. **Featured launches** — *changed.* Cards gain taken-in (with the correct unit
   symbol), the pairing label and relative age, reusing the helpers the Explore
   page already uses.
6. **Sectors** — *changed.* Text chips become textured tiles: image, ink scrim,
   sector label, live company count.
7. **Closing CTA** — *changed.* `hero.webp` reused as a low-opacity backdrop.

## Data and honesty

The stats band shows four figures:

- Launches in the current scan window
- Graduated
- Near graduation (progress >= 0.6)
- Launch fee, read live from `launchFee()`

**`realQuoteReserve` must not be summed across launches.** Quote assets differ
per launch — ETH, TSLA, GLD, SLV — so a single "total value" figure would add
unlike units and state a number that is true of nothing. The four figures above
were chosen because each is honest without cross-asset conversion. If a total is
ever wanted it must be scoped to one quote asset and labelled as such.

Degradation: when the RPC is throttled or unreachable the band renders the
existing `Unavailable` component per figure, not zeros. A zero reads as "nothing
has launched", which is false. This matches how `MarketCard` already handles a
missing quote.

The sector counts come from the same `resolveLuxuryMarkets()` result the page
already awaits, so the tiles add no RPC calls.

## Risks

- **Build budget.** Static generation has a 60s per-page ceiling that this repo
  has hit before. Images add bytes but no RPC calls, so the throttling profile is
  unchanged; `next build` must still pass.
- **Generated image quality.** Output that reads as cheap stock texture would be
  worse than no image. Each is reviewed before it ships, and any that does not
  hold up is regenerated or dropped.
- **Contrast.** Labels sit over imagery in the sector tiles. The scrim must keep
  text legible at the existing `--color-ground` contrast level.

## Verification

- `next build` passes within the static-generation budget.
- All 31 live tests stay green.
- Landing page screenshotted and reviewed at desktop and mobile widths.
- Stats band checked in its degraded state, not only its happy path.
