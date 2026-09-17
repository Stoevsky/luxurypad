# Landing Page Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the LuxuryPad landing page original abstract imagery and a live protocol stats band, without fabricating data or implying any luxury house endorses the product.

**Architecture:** Two new pure modules (`stats.ts`, `sector-art.ts`) hold all testable logic and are covered by unit tests. Three new presentational components (`StatsBand`, `SectorTile`, `LaunchCard`) keep `page.tsx` from growing unwieldy. `LaunchCard` is extracted from the Explore page so both pages share one card instead of diverging. Eight generated textures live in `public/textures/` and are served through `next/image`.

**Tech Stack:** Next.js 16.3.5 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4, viem, Vitest 5.

Spec: `docs/superpowers/specs/2026-09-17-landing-page-enhancement-design.md`

---

## File Structure

**Create**

| Path | Responsibility |
| --- | --- |
| `src/lib/landing/stats.ts` | Pure counting over `LaunchSummary[]`. No I/O. |
| `src/lib/registry/sector-art.ts` | Sector → texture path mapping. Pure. |
| `src/components/stats-band.tsx` | Renders the four stats, incl. degraded state. |
| `src/components/sector-tile.tsx` | One textured sector tile. |
| `src/components/launch-card.tsx` | Shared launch card, extracted from Explore. |
| `tests/landing.test.ts` | Unit tests for the two pure modules. |
| `public/textures/*.webp` | Eight generated abstract textures. |

**Modify**

| Path | Change |
| --- | --- |
| `src/app/page.tsx` | Hero image, stats band, sector tiles, shared card, CTA backdrop. |
| `src/app/explore/page.tsx` | Use the shared `LaunchCard` instead of its local copy. |

**Note on tests:** `vitest.config.ts` sets `environment: "node"` with no jsdom or
React Testing Library, so component rendering is not testable here. All four
existing suites are `*.live.test.ts` and hit mainnet. `tests/landing.test.ts` is
therefore a pure unit suite — it makes no network calls and must stay fast.

---

### Task 1: Pure launch statistics

**Files:**
- Create: `src/lib/landing/stats.ts`
- Test: `tests/landing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/landing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { summarizeLaunches } from "@/lib/landing/stats";
import type { LaunchSummary } from "@/lib/indexer/launches";
import type { LaunchPhase } from "@/lib/pons/curve";

/** Only the two fields `summarizeLaunches` reads. */
function launch(phase: LaunchPhase, progress: number): LaunchSummary {
  return { phase, progress } as LaunchSummary;
}

describe("summarizeLaunches", () => {
  it("returns zeros for an empty list", () => {
    expect(summarizeLaunches([])).toEqual({ total: 0, graduated: 0, nearGraduation: 0 });
  });

  it("counts every launch in total", () => {
    const stats = summarizeLaunches([launch("curve", 0.1), launch("curve", 0.2)]);
    expect(stats.total).toBe(2);
  });

  it("counts graduated launches", () => {
    const stats = summarizeLaunches([launch("graduated", 1), launch("curve", 0.1)]);
    expect(stats.graduated).toBe(1);
  });

  it("counts a launch at exactly 60% as near graduation", () => {
    expect(summarizeLaunches([launch("curve", 0.6)]).nearGraduation).toBe(1);
  });

  it("does not count a launch below 60% as near graduation", () => {
    expect(summarizeLaunches([launch("curve", 0.59)]).nearGraduation).toBe(0);
  });

  it("never counts a graduated launch as also near graduation", () => {
    // Mirrors sectionOf() in launches.ts, where graduated wins outright.
    const stats = summarizeLaunches([launch("graduated", 1)]);
    expect(stats.graduated).toBe(1);
    expect(stats.nearGraduation).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/landing.test.ts`
Expected: FAIL — cannot resolve `@/lib/landing/stats`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/landing/stats.ts`:

```ts
import type { LaunchSummary } from "@/lib/indexer/launches";

export type LaunchStats = {
  total: number;
  graduated: number;
  nearGraduation: number;
};

/**
 * Counts only, and deliberately so.
 *
 * `realQuoteReserve` is NOT summed here. Quote assets differ per launch — ETH,
 * TSLA, GLD, SLV — so adding them produces a number in no unit at all, true of
 * nothing. Any future total must be scoped to a single quote asset and labelled
 * with it.
 *
 * The graduated/near-graduation split mirrors `sectionOf` in
 * ../indexer/launches.ts: graduated wins outright, so a launch is never counted
 * in both buckets.
 */
export function summarizeLaunches(launches: LaunchSummary[]): LaunchStats {
  let graduated = 0;
  let nearGraduation = 0;
  for (const l of launches) {
    if (l.phase === "graduated") graduated += 1;
    else if (l.progress >= 0.6) nearGraduation += 1;
  }
  return { total: launches.length, graduated, nearGraduation };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/landing.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/landing/stats.ts tests/landing.test.ts
git commit -m "Add pure launch statistics for the landing page"
```

---

### Task 2: Sector texture mapping

**Files:**
- Create: `src/lib/registry/sector-art.ts`
- Modify: `tests/landing.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/landing.test.ts`:

```ts
import { sectorTexture } from "@/lib/registry/sector-art";
import { LUXURY_COMPANIES } from "@/lib/registry/luxury";

describe("sectorTexture", () => {
  it("has a texture for every sector that has an enabled company", () => {
    // The invariant that matters: adding a company in a new sector must not
    // silently render a blank tile on the landing page.
    const represented = new Set(
      LUXURY_COMPANIES.filter((c) => c.enabled).map((c) => c.sector),
    );
    expect(represented.size).toBeGreaterThan(0);
    for (const sector of represented) {
      expect(sectorTexture(sector), `sector "${sector}" has companies but no texture`).not.toBeNull();
    }
  });

  it("returns null for a sector with no artwork", () => {
    expect(sectorTexture("other")).toBeNull();
  });

  it("returns a path under /textures", () => {
    expect(sectorTexture("fashion")).toMatch(/^\/textures\/.+\.webp$/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/landing.test.ts`
Expected: FAIL — cannot resolve `@/lib/registry/sector-art`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/registry/sector-art.ts`:

```ts
import type { LuxurySector } from "./luxury";

/**
 * Abstract textures generated for this project.
 *
 * Each depicts a MATERIAL — silk, aluminium, marble, gold leaf — never a brand,
 * product, logo or wordmark. That is the point: the luxury houses in
 * ./luxury.ts have no tokenized asset and have endorsed nothing, so the page
 * must evoke a category without borrowing a trademark.
 *
 * Decorative only. Every tile also states its sector in text, so nothing is
 * communicated by the image alone.
 */
export const SECTOR_TEXTURES: Partial<Record<LuxurySector, string>> = {
  fashion: "/textures/fashion.webp",
  automotive: "/textures/automotive.webp",
  watches: "/textures/watches.webp",
  materials: "/textures/materials.webp",
  conglomerate: "/textures/conglomerate.webp",
  beauty: "/textures/beauty.webp",
  hospitality: "/textures/hospitality.webp",
};

export function sectorTexture(sector: LuxurySector): string | null {
  return SECTOR_TEXTURES[sector] ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/landing.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/registry/sector-art.ts tests/landing.test.ts
git commit -m "Map luxury sectors to abstract textures"
```

---

### Task 3: Generate and install the eight textures

**Files:**
- Create: `public/textures/hero.webp`, `fashion.webp`, `automotive.webp`, `watches.webp`, `materials.webp`, `conglomerate.webp`, `beauty.webp`, `hospitality.webp`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p public/textures
```

- [ ] **Step 2: Generate the images**

Use `generate_image_batch` with the eight prompts below, then `jobs_wait`, then
`show_generation_by_ids` to collect URLs.

Every prompt ends with the same constraint clause, because the legal and
editorial requirement is identical for all eight:

> `no logos, no text, no lettering, no brand marks, no people, no recognisable products; abstract macro material study; muted palette of ivory #f4f0e8, deep near-black #11100f, antique gold #b99a62, champagne #d8c5a0; soft directional studio light; fine grain; editorial still-life photography`

| File | Subject clause (prepend to the constraint clause) |
| --- | --- |
| `hero.webp` | `layered folds of ivory silk over pale stone with a single torn edge of gold leaf, vertical composition` |
| `fashion.webp` | `folded ivory silk and fine woven fabric, raking light across the weave` |
| `automotive.webp` | `brushed aluminium and carbon-fibre weave, cool metal sheen with one warm gold reflection` |
| `watches.webp` | `guilloché engraving, concentric machined metal grooves, extreme macro` |
| `materials.webp` | `torn gold leaf laid over pale limestone, visible leaf texture` |
| `conglomerate.webp` | `pale marble with fine dark veining and a faint gold seam` |
| `beauty.webp` | `soft cream and powder swirl, matte pigment, gentle gradient` |
| `hospitality.webp` | `travertine stone wall in warm late afternoon light, shallow relief` |

Aspect ratios: `hero.webp` portrait (4:5). The seven sector textures landscape (5:3).

- [ ] **Step 3: Download and convert to WebP**

```bash
mkdir -p /tmp/lux-art
# For each generated URL, download to /tmp/lux-art/<name>.png, then:
cd /Users/stoevski/luxurypad
for f in hero fashion automotive watches materials conglomerate beauty hospitality; do
  sips -s format jpeg "/tmp/lux-art/$f.png" --out "/tmp/lux-art/$f.jpg" >/dev/null
  npx sharp-cli -i "/tmp/lux-art/$f.jpg" -o "public/textures/$f.webp" -f webp -q 82
done
ls -la public/textures/
```

If `sharp-cli` is unavailable, use `sips -s format` to produce JPEG and change
the extensions in `sector-art.ts` and the hero markup to `.jpg` instead. Do not
ship PNGs — they are several times larger at this size.

- [ ] **Step 4: Review each image before shipping**

Open each file. Reject and regenerate any that contains lettering, a logo, a
recognisable product, or reads as cheap stock texture. A bad image here is worse
than no image.

- [ ] **Step 5: Verify total weight**

```bash
du -sh public/textures/
```
Expected: under 1.5 MB total. If larger, re-encode at `-q 70`.

- [ ] **Step 6: Run the sector texture test**

Run: `npx vitest run tests/landing.test.ts`
Expected: PASS — the mapping test now points at files that exist.

- [ ] **Step 7: Commit**

```bash
git add public/textures
git commit -m "Add generated abstract sector textures"
```

---

### Task 4: Extract the shared launch card

The Explore page defines a `LaunchCard` locally. The landing page needs the same
card with the same data, so it moves to a shared component rather than being
copied.

**Files:**
- Create: `src/components/launch-card.tsx`
- Modify: `src/app/explore/page.tsx:87-136` (remove the local `LaunchCard`, import the shared one)

- [ ] **Step 1: Create the shared component**

Create `src/components/launch-card.tsx`:

```tsx
import Link from "next/link";
import { Card, Progress, StatePill } from "@/components/ui";
import { pairingLabel, type LuxuryMarket } from "@/lib/registry/resolve";
import { formatQuoteAmount, relativeAge } from "@/lib/format";
import type { LaunchSummary } from "@/lib/indexer/launches";

const NATIVE = "0x0000000000000000000000000000000000000000";

export function LaunchCard({
  launch,
  market,
  quoteSymbol: registrySymbol,
}: {
  launch: LaunchSummary;
  market?: LuxuryMarket;
  quoteSymbol?: string;
}) {
  const isNativeQuote = launch.quoteAsset === NATIVE;
  // Name the unit whenever it is known. An unlabelled "13.993" reads as ETH to
  // anyone skimming, which is exactly the wrong thing for a Stock Token pair.
  const quoteSymbol = isNativeQuote ? "ETH" : market?.asset?.symbol ?? registrySymbol ?? "";
  return (
    <Link href={`/token/${launch.token}`} className="block">
      <Card interactive className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="display truncate text-[19px] leading-tight">{launch.name}</p>
            <p className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
              ${launch.symbol}
            </p>
          </div>
          {market ? <StatePill state={market.state} /> : null}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="eyebrow">Taken in</dt>
            <dd className="tabular">{formatQuoteAmount(launch.realQuoteReserve, quoteSymbol)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Creator tax</dt>
            <dd className="tabular">{(launch.creatorTaxBps / 100).toFixed(2)}%</dd>
          </div>
        </dl>

        <div className="mt-auto space-y-3">
          <Progress value={launch.progress} label={`${Math.round(launch.progress * 100)}% to graduation`} />
          <p className="text-[11px] text-muted">
            {/* Pairing language is guarded: only a verified market may say "Paired with". */}
            {pairingLabel(market, { isNativeQuote })}
            {" · "}
            {relativeAge(launch.launchedAt)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Update the Explore page**

In `src/app/explore/page.tsx`, delete the entire local `function LaunchCard(...)`
block at the bottom of the file (lines 87-136), and delete `Link`, `Progress`,
`StatePill`, `formatQuoteAmount`, `relativeAge` and `pairingLabel` from the
imports if nothing else in the file uses them. Add:

```ts
import { LaunchCard } from "@/components/launch-card";
```

The existing call site inside the section map is unchanged:

```tsx
<LaunchCard
  key={l.token}
  launch={l}
  market={byAddress.get(l.quoteAsset.toLowerCase())}
  quoteSymbol={symbolByAddress.get(l.quoteAsset.toLowerCase())}
/>
```

Keep the `type LuxuryMarket` import only if still referenced; the shared card now
owns that type usage.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any now-unused import the compiler flags.

- [ ] **Step 4: Verify Explore still renders**

```bash
curl -s --max-time 180 http://localhost:3750/explore -o /tmp/ex.html \
  -w "status=%{http_code}\n"
grep -c 'Launch data is unavailable' /tmp/ex.html   # expect 0
grep -o 'href="/token/0x[0-9a-fA-F]*"' /tmp/ex.html | sort -u | wc -l  # expect 48
```

If the count is 0 and the page is slow, the public RPC is throttling — wait a
minute and retry before assuming a regression.

- [ ] **Step 5: Commit**

```bash
git add src/components/launch-card.tsx src/app/explore/page.tsx
git commit -m "Extract the shared launch card from the Explore page"
```

---

### Task 5: Stats band

**Files:**
- Create: `src/components/stats-band.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/stats-band.tsx`:

```tsx
import { Container, Stat, Unavailable } from "@/components/ui";
import { formatAmount } from "@/lib/format";
import type { LaunchStats } from "@/lib/landing/stats";

/**
 * `stats` is null when the chain read failed. Every figure then renders
 * `Unavailable` rather than 0 — a zero here would read as "nothing has ever
 * launched", which is false and is exactly the fabrication this repo forbids.
 */
export function StatsBand({
  stats,
  launchFeeWei,
}: {
  stats: LaunchStats | null;
  launchFeeWei: bigint | null;
}) {
  const hint = "Chain data is temporarily unavailable";
  return (
    <section className="border-b border-line bg-card">
      <Container className="grid grid-cols-2 gap-x-8 gap-y-7 py-9 sm:py-11 lg:grid-cols-4">
        <Stat label="Launches indexed">
          {stats ? stats.total.toLocaleString() : <Unavailable hint={hint} />}
        </Stat>
        <Stat label="Graduated">
          {stats ? stats.graduated.toLocaleString() : <Unavailable hint={hint} />}
        </Stat>
        <Stat label="Near graduation">
          {stats ? stats.nearGraduation.toLocaleString() : <Unavailable hint={hint} />}
        </Stat>
        <Stat label="Launch fee">
          {launchFeeWei !== null ? `${formatAmount(launchFeeWei, 18, 6)} ETH` : <Unavailable hint={hint} />}
        </Stat>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `src/app/page.tsx`, extend the existing `Promise.all` and compute the stats.
Replace the data-fetching block at the top of `HomePage` with:

```tsx
// Hydrating the whole scan window keeps every figure in the band over the same
// denominator. A bare listLaunches(48) would cap the count at 48 and report
// "48 launches" for a window holding more, which is a quiet lie.
// HYDRATION_CAP bounds the fan-out: each launch costs two multicalls, and the
// public RPC throttles. If a window ever exceeds it, every figure is over the
// capped sample and stays mutually consistent.
const HYDRATION_CAP = 120;

const [{ markets, registryUnavailable }, scanned, feeWei] = await Promise.all([
  resolveLuxuryMarkets(),
  scanLaunches().catch(() => [] as IndexedLaunch[]),
  launchFee().catch(() => null),
]);

// scanLaunches is singleFlight-cached, so listLaunches reuses that same
// eth_getLogs rather than issuing a second one.
const launches = scanned.length
  ? await listLaunches(Math.min(scanned.length, HYDRATION_CAP)).catch(() => [] as LaunchSummary[])
  : [];

const launchable = markets.filter((m) => m.launchable);
const featured = markets.slice(0, 6);
// An empty result means the scan failed, not that the protocol is empty.
const stats = launches.length > 0 ? summarizeLaunches(launches) : null;
```

Add these imports:

```ts
import { listLaunches, scanLaunches, type IndexedLaunch, type LaunchSummary } from "@/lib/indexer/launches";
import { summarizeLaunches } from "@/lib/landing/stats";
import { launchFee } from "@/lib/pons/pairs";
import { StatsBand } from "@/components/stats-band";
```

This replaces the existing `import { listLaunches } from "@/lib/indexer/launches";`.
The Featured section below now slices what it needs with `launches.slice(0, 6)`.

Insert the band immediately after the closing `</section>` of the hero:

```tsx
<StatsBand stats={stats} launchFeeWei={feeWei} />
```

- [ ] **Step 3: Update the Featured launches section to slice**

In the Featured launches section, change the map source from `launches` to
`launches.slice(0, 6)` and swap the inline card for the shared component:

```tsx
<div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {launches.slice(0, 6).map((l) => (
    <LaunchCard key={l.token} launch={l} />
  ))}
</div>
```

Add `import { LaunchCard } from "@/components/launch-card";`. The `market` and
`quoteSymbol` props are optional; without them the card falls back to
"Paired with a pair asset", which is the honest wording for an unresolved quote.

- [ ] **Step 4: Type-check and view**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
curl -s --max-time 180 http://localhost:3750/ -o /tmp/home.html -w "status=%{http_code}\n"
grep -o 'Launches indexed\|Graduated\|Near graduation\|Launch fee' /tmp/home.html | sort -u
```
Expected: all four labels present.

- [ ] **Step 5: Commit**

```bash
git add src/components/stats-band.tsx src/app/page.tsx
git commit -m "Add a live protocol stats band to the landing page"
```

---

### Task 6: Textured sector tiles

**Files:**
- Create: `src/components/sector-tile.tsx`
- Modify: `src/app/page.tsx` (the Sectors section)

- [ ] **Step 1: Create the component**

Create `src/components/sector-tile.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { sectorTexture } from "@/lib/registry/sector-art";
import { SECTOR_LABELS, type LuxurySector } from "@/lib/registry/luxury";

/**
 * The texture is decorative: `alt=""` and the label is real text, so the tile
 * still reads correctly if the image fails to load or is not perceived.
 */
export function SectorTile({ sector, count }: { sector: LuxurySector; count: number }) {
  const texture = sectorTexture(sector);
  return (
    <Link
      href={`/markets#${sector}`}
      className="group relative block overflow-hidden border border-line transition-colors duration-200 hover:border-gold"
    >
      <div className="relative aspect-[5/3]">
        {texture ? (
          <Image
            src={texture}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-ground" />
        )}
        {/* Scrim: keeps the label legible over any texture. */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <p className="display text-[17px] leading-tight text-ground">{SECTOR_LABELS[sector]}</p>
          <p className="tabular shrink-0 text-[12px] text-ground/75">{count}</p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Replace the chip row**

In `src/app/page.tsx`, replace the entire Sectors section body (the
`<div className="mt-7 flex flex-wrap gap-2">…</div>` block) with:

```tsx
<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {SECTOR_ORDER.filter((s) => markets.some((m) => m.company.sector === s)).map((s) => (
    <SectorTile
      key={s}
      sector={s}
      count={markets.filter((m) => m.company.sector === s).length}
    />
  ))}
</div>
```

Add `import { SectorTile } from "@/components/sector-tile";` and the
`LuxurySector` type is already covered by `SECTOR_ORDER`.

- [ ] **Step 3: Type-check and view**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
curl -s --max-time 180 http://localhost:3750/ -o /tmp/home.html -w "status=%{http_code}\n"
grep -o '/textures/[a-z]*\.webp' /tmp/home.html | sort -u
```
Expected: seven distinct sector texture paths.

- [ ] **Step 4: Commit**

```bash
git add src/components/sector-tile.tsx src/app/page.tsx
git commit -m "Replace sector chips with textured tiles"
```

---

### Task 7: Hero image and closing backdrop

**Files:**
- Modify: `src/app/page.tsx` (hero right column, closing CTA)

- [ ] **Step 1: Wrap the hero card in the image frame**

In the hero `Container`, replace the bare `<Card className="p-6">…</Card>` with
the block below. The existing card contents (the `Verified launch pairs` heading,
`Rule`, `<ul>` and footnote) are unchanged — only the wrapper and the card's
className change.

```tsx
<div className="relative">
  <div className="relative aspect-[4/5] overflow-hidden border border-line">
    <Image
      src="/textures/hero.webp"
      alt=""
      fill
      priority
      sizes="(min-width: 1024px) 42vw, 100vw"
      className="object-cover"
    />
  </div>
  {/* The product UI stays the hero. The texture frames it; it does not replace it. */}
  <Card className="relative -mt-20 mx-4 p-6 shadow-[0_18px_40px_-28px_rgb(17_16_15/0.55)] sm:mx-8">
    {/* …existing card contents, unchanged… */}
  </Card>
</div>
```

Add `import Image from "next/image";` at the top of the file.

- [ ] **Step 2: Add the closing backdrop**

Replace the final CTA `<section>` with:

```tsx
<section className="relative overflow-hidden">
  <Image
    src="/textures/hero.webp"
    alt=""
    fill
    sizes="100vw"
    className="object-cover opacity-[0.14]"
  />
  <Container className="relative py-20 text-center sm:py-28">
    <h2 className="display text-[clamp(2.2rem,5.5vw,3.4rem)]">Launch something iconic.</h2>
    <div className="mt-8 flex justify-center">
      <ButtonLink href="/launch" size="lg">
        Start a launch
      </ButtonLink>
    </div>
  </Container>
</section>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "Frame the hero and closing CTA with generated texture"
```

---

### Task 8: Full verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Run the full test suite**

```bash
set -a && . ./.env.local && set +a && npx vitest run
```
Expected: 5 files, 40 tests passing (31 existing live + 9 new unit).

- [ ] **Step 2: Production build**

```bash
set -a && . ./.env.local && set +a && npm run build
```
Expected: `✓ Compiled successfully`, TypeScript clean, static pages generated.
The 60s per-page static-generation ceiling has bitten this repo before; if
`/`, `/explore` or `/markets` time out, the cause is RPC throttling rather than
the images — wait and retry before changing code.

- [ ] **Step 3: Screenshot desktop and mobile**

Start the server with `preview_start` (name `luxurypad`, port 3750), then
screenshot the landing page. Resize to 390px wide and screenshot again.
Check: sector labels legible over every texture, hero card overlap not clipped,
stats band readable at two columns on mobile.

- [ ] **Step 4: Verify the degraded stats path**

The band must never show zeros when the chain is unreachable. Confirm by
temporarily pointing the RPC at an unroutable host:

```bash
RPC_URL=http://127.0.0.1:9 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:9 \
  npx next dev -p 3751
curl -s --max-time 120 http://localhost:3751/ | grep -c 'Unavailable'
```
Expected: greater than 0, and no `>0<` stat values. Stop that server afterwards.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found in landing page verification"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| Eight textures in `public/textures/`, palette-keyed | 3 |
| Seven sectors represented; unused sectors get no texture | 2, 6 |
| Images decorative, `alt=""` | 6, 7 |
| Hero keeps product-UI card, gains image | 7 |
| Stats band: launches, graduated, near graduation, fee | 1, 5 |
| `realQuoteReserve` never summed | 1 (enforced in code comment + no such field) |
| Degraded state renders `Unavailable`, not zeros | 5, 8 step 4 |
| Sector tiles with live counts | 6 |
| Featured launches gain taken-in, pairing, age | 4, 5 |
| Closing CTA backdrop | 7 |
| `How it works` unchanged | — (deliberately untouched) |
| Build passes, 31 live tests green, screenshots | 8 |

**Type consistency**

`LaunchStats` is defined in Task 1 and consumed in Task 5 with the same three
fields. `sectorTexture` is defined in Task 2 and called in Task 6. `LaunchCard`
is defined in Task 4 with props `{ launch, market?, quoteSymbol? }` and called in
Tasks 4 and 5 consistently. `launchFee()` returns `Promise<bigint>` and is
narrowed to `bigint | null` at the call site in Task 5, matching `StatsBand`.

**Placeholder scan:** none. Every code step contains complete code.
