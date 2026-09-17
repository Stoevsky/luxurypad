import Link from "next/link";
import { Container, Eyebrow, ButtonLink, Card, Rule, Progress } from "@/components/ui";
import { MarketCard } from "@/components/market-card";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";
import { listLaunches } from "@/lib/indexer/launches";
import { SECTOR_LABELS, SECTOR_ORDER } from "@/lib/registry/luxury";

export const revalidate = 60;

const STEPS = [
  { n: "01", title: "Choose the market", body: "Pick from supported luxury-market assets." },
  { n: "02", title: "Create your token", body: "Name, ticker, image, story." },
  { n: "03", title: "Launch", body: "Your wallet signs through the underlying protocol." },
  { n: "04", title: "Trade", body: "Curve → graduation → liquidity." },
];

export default async function HomePage() {
  const [{ markets, registryUnavailable }, launches] = await Promise.all([
    resolveLuxuryMarkets(),
    listLaunches(6).catch(() => []),
  ]);

  const launchable = markets.filter((m) => m.launchable);
  const featured = markets.slice(0, 6);

  return (
    <>
      {/* ——— Hero ——— */}
      <section className="border-b border-line">
        <Container className="grid gap-12 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
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

          {/* Product UI as the hero visual — not stock supercar photography. */}
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
        </Container>
      </section>

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
              {launches.map((l) => (
                <Link key={l.token} href={`/token/${l.token}`} className="block">
                  <Card interactive className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="display truncate text-[19px]">{l.name}</p>
                      <p className="tabular shrink-0 text-[12px] text-muted">${l.symbol}</p>
                    </div>
                    <div className="mt-auto space-y-2">
                      <Progress
                        value={l.progress}
                        label={`${Math.round(l.progress * 100)}% to graduation`}
                      />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* ——— Sectors ——— */}
      <section className="border-b border-line">
        <Container className="py-16 sm:py-20">
          <Eyebrow>Luxury sectors</Eyebrow>
          <div className="mt-7 flex flex-wrap gap-2">
            {SECTOR_ORDER.filter((s) => markets.some((m) => m.company.sector === s)).map((s) => (
              <Link
                key={s}
                href={`/markets#${s}`}
                className="border border-line bg-card px-4 py-2 text-[13px] transition-colors duration-200 hover:border-gold"
              >
                {SECTOR_LABELS[s]}
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* ——— Final CTA ——— */}
      <section>
        <Container className="py-20 text-center sm:py-28">
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
