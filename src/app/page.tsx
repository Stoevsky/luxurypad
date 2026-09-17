import Link from "next/link";
import Image from "next/image";
import { Container, Eyebrow, ButtonLink, Card, Rule } from "@/components/ui";
import { MarketCard } from "@/components/market-card";
import { LaunchCard } from "@/components/launch-card";
import { HeroPreview } from "@/components/hero-preview";
import { StatsBand } from "@/components/stats-band";
import { SectorTile } from "@/components/sector-tile";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";
import {
  listLaunches,
  scanLaunches,
  type IndexedLaunch,
  type LaunchSummary,
} from "@/lib/indexer/launches";
import { summarizeLaunches } from "@/lib/landing/stats";
import { launchFee } from "@/lib/pons/pairs";
import { getStockTokenRegistry } from "@/lib/registry/stock-tokens";
import { SECTOR_LABELS, SECTOR_ORDER } from "@/lib/registry/luxury";

export const revalidate = 60;

/**
 * Hydrating the whole scan window keeps every figure in the stats band over the
 * same denominator. A bare `listLaunches(6)` would cap the count at 6 and report
 * "6 launches" for a window holding more, which is a quiet lie.
 *
 * The cap bounds the fan-out: each launch costs two multicalls and the public
 * RPC throttles. If a window ever exceeds it, every figure is computed over the
 * same capped sample and so stays mutually consistent.
 */
const HYDRATION_CAP = 120;

/** Pons uses the zero address to mean the chain's native asset. */
const NATIVE = "0x0000000000000000000000000000000000000000";

const STEPS = [
  { n: "01", title: "Choose the market", body: "Pick from supported luxury-market assets." },
  { n: "02", title: "Create your token", body: "Name, ticker, image, story." },
  { n: "03", title: "Launch", body: "Your wallet signs through the underlying protocol." },
  { n: "04", title: "Trade", body: "Curve → graduation → liquidity." },
];

export default async function HomePage() {
  const [{ markets, registryUnavailable }, scanned, feeWei, registry] = await Promise.all([
    resolveLuxuryMarkets(),
    scanLaunches().catch(() => [] as IndexedLaunch[]),
    launchFee().catch(() => null),
    // Already fetched and cached by the resolve above — this costs nothing.
    getStockTokenRegistry().catch(() => null),
  ]);

  // scanLaunches is singleFlight-cached, so listLaunches reuses that same
  // eth_getLogs rather than issuing a second one.
  const launches = scanned.length
    ? await listLaunches(Math.min(scanned.length, HYDRATION_CAP)).catch(() => [] as LaunchSummary[])
    : [];

  const launchable = markets.filter((m) => m.launchable);
  const featured = markets.slice(0, 6);
  // An empty result means the scan failed, not that the protocol is empty.
  // scanned.length is the exact window count; launches.length is only what
  // hydrated, so the two are passed separately rather than conflated.
  const stats = launches.length > 0 ? summarizeLaunches(launches, scanned.length) : null;

  // The same two lookups the Explore page builds, so a launch card carries the
  // identical pairing language and unit symbol on both pages.
  const marketByAddress = new Map(
    markets.filter((m) => m.asset).map((m) => [m.asset!.address.toLowerCase(), m]),
  );
  const symbolByAddress = new Map(
    (registry ?? []).map((a) => [a.address.toLowerCase(), a.symbol]),
  );

  // The hero preview needs a launch that is still on its curve: a graduated one
  // would render a trade panel the real page replaces with a "curve is closed"
  // notice, so it would be showing a screen that cannot exist for that token.
  const heroLaunch = launches.find((l) => l.phase === "curve") ?? launches[0] ?? null;

  return (
    <>
      {/* ——— Hero ——— */}
      <section className="border-b border-line">
        {/* items-start, not items-center: the right column is far taller than
            the copy, and centring split the difference into equal voids above
            and below the headline — which pushed the headline under the fold. */}
        <Container className="grid gap-12 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:py-24">
          <div className="reveal space-y-7">
            <Eyebrow>Pons V2 · Robinhood Chain</Eyebrow>
            <h1 className="display text-[clamp(2.9rem,7vw,4.6rem)]">
              Luxury,
              <br />
              launched onchain.
            </h1>
            <p className="max-w-lg text-[16px] leading-relaxed text-muted">
              Discover and launch tokens around the companies and narratives defining global luxury
              markets.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/launch" size="lg">
                Launch
              </ButtonLink>
              <ButtonLink href="/explore" variant="secondary" size="lg">
                Explore
              </ButtonLink>
            </div>
          </div>

          {/* Product UI as the hero visual — not stock supercar photography and
              no longer a texture panel either. Showing the actual trade surface
              says more about what this is than any image could. */}
          <div className="space-y-4">
            {/* Rendered even with no launch to show. The RPC rate-limits often
                enough that dropping the panel would leave the hero's right
                column collapsing at random; the shell degrades field by field
                instead, the same way the stats band does. */}
            <HeroPreview
              launch={heroLaunch}
              quoteSymbol={
                !heroLaunch
                  ? null
                  : heroLaunch.quoteAsset === NATIVE
                    ? "ETH"
                    : symbolByAddress.get(heroLaunch.quoteAsset.toLowerCase()) ?? "pair asset"
              }
            />
            <Card className="p-6">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Verified launch pairs</p>
                <p className="tabular text-[13px] text-muted">{launchable.length} live</p>
              </div>
              <Rule className="my-4" />
              <ul className="space-y-3.5">
                {launchable.slice(0, 5).map((m) => (
                  <li key={m.company.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[14px]">{m.company.companyName}</p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
                        {m.asset?.symbol} · {SECTOR_LABELS[m.company.sector]}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-[14px]">
                      {m.quote ? `$${m.quote.ask.toFixed(2)}` : "—"}
                    </p>
                  </li>
                ))}
                {launchable.length === 0 ? (
                  <li className="py-4 text-[13px] text-muted">
                    {registryUnavailable
                      ? "The asset registry is unavailable right now."
                      : "No launch pairs are currently available."}
                  </li>
                ) : null}
              </ul>
              <Rule className="my-4" />
              <p className="text-[11px] leading-relaxed text-muted">
                Every pair above was confirmed against the Pons launch contract before being shown.
              </p>
            </Card>
          </div>
        </Container>
      </section>

      <StatsBand stats={stats} launchFeeWei={feeWei} />

      {/* ——— Markets ——— */}
      <section className="border-b border-line">
        <Container className="py-16 sm:py-20">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-2">
              <Eyebrow>Markets</Eyebrow>
              <h2 className="display text-[clamp(1.9rem,4vw,2.6rem)]">
                Explore supported luxury companies.
              </h2>
            </div>
            <Link href="/markets" className="shrink-0 text-[13px] text-muted hover:text-ink">
              All markets →
            </Link>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((m) => (
              <MarketCard key={m.company.id} market={m} />
            ))}
          </div>
        </Container>
      </section>

      {/* ——— How it works ——— */}
      <section className="border-b border-line">
        <Container className="py-16 sm:py-20">
          <Eyebrow>How it works</Eyebrow>
          <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-card p-6">
                <p className="tabular display text-[26px] text-champagne">{s.n}</p>
                <p className="mt-3 text-[15px]">{s.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ——— Featured launches (real, from chain) ——— */}
      <section className="border-b border-line">
        <Container className="py-16 sm:py-20">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-2">
              <Eyebrow>Featured launches</Eyebrow>
              <h2 className="display text-[clamp(1.9rem,4vw,2.6rem)]">Live on the curve.</h2>
            </div>
            <Link href="/explore" className="shrink-0 text-[13px] text-muted hover:text-ink">
              Explore all →
            </Link>
          </div>

          {launches.length === 0 ? (
            <Card className="mt-8 p-8 text-center text-[13px] text-muted">
              Launch data is unavailable right now.
            </Card>
          ) : (
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {launches.slice(0, 6).map((l) => (
                <LaunchCard
                  key={l.token}
                  launch={l}
                  market={marketByAddress.get(l.quoteAsset.toLowerCase())}
                  quoteSymbol={symbolByAddress.get(l.quoteAsset.toLowerCase())}
                />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* ——— Sectors ——— */}
      <section className="border-b border-line">
        <Container className="py-16 sm:py-20">
          <Eyebrow>Luxury sectors</Eyebrow>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECTOR_ORDER.filter((s) => markets.some((m) => m.company.sector === s)).map((s) => (
              <SectorTile
                key={s}
                sector={s}
                count={markets.filter((m) => m.company.sector === s).length}
              />
            ))}
          </div>
        </Container>
      </section>

      {/* ——— Final CTA ——— */}
      <section className="relative overflow-hidden">
        {/* The hero texture again, far back. It bookends the page without
            competing with the type in front of it. */}
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
    </>
  );
}
