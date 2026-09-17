import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Card, Progress, StatePill } from "@/components/ui";
import { listLaunches, sectionOf, type LaunchSummary } from "@/lib/indexer/launches";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";
import { formatQuoteAmount, relativeAge } from "@/lib/format";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Explore",
  description: "Featured, new, trending and graduated launches on LuxuryPad.",
};

const SECTIONS = [
  { id: "new", title: "New", blurb: "Launched in the last six hours." },
  { id: "trending", title: "Trending", blurb: "Active on the curve." },
  { id: "near_graduation", title: "Near graduation", blurb: "Past 60% of the threshold." },
  { id: "graduated", title: "Graduated", blurb: "Liquidity seeded and permanently locked." },
] as const;

export default async function ExplorePage() {
  const [launches, { markets }] = await Promise.all([
    listLaunches(48).catch(() => [] as LaunchSummary[]),
    resolveLuxuryMarkets().catch(() => ({ markets: [] as never[] })),
  ]);

  // Map a launch's quote asset back to a luxury market, when there is one.
  const byAddress = new Map(
    markets.filter((m) => m.asset).map((m) => [m.asset!.address.toLowerCase(), m]),
  );

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <Eyebrow>Explore</Eyebrow>
        <h1 className="display text-[clamp(2.4rem,5.5vw,3.4rem)]">Every launch, as it stands.</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Read directly from the Pons factory on Robinhood Chain. Progress, phase and reserves come
          from the curve itself.
        </p>
      </div>

      {launches.length === 0 ? (
        <Card className="mt-10 p-8 text-center text-[13px] text-muted">
          Launch data is unavailable right now. This page shows chain data only — nothing is
          simulated while the network is unreachable.
        </Card>
      ) : (
        SECTIONS.map((section) => {
          const items = launches.filter((l) => sectionOf(l) === section.id);
          if (items.length === 0) return null;
          return (
            <section key={section.id} className="mt-14">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="display text-[24px]">{section.title}</h2>
                <p className="text-[12px] text-muted">{section.blurb}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => (
                  <LaunchCard key={l.token} launch={l} market={byAddress.get(l.quoteAsset.toLowerCase())} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </Container>
  );
}

function LaunchCard({
  launch,
  market,
}: {
  launch: LaunchSummary;
  market?: { company: { companyName: string }; state: "PAIR_AVAILABLE" | "DISCOVERY_ONLY" | "THEME_ONLY" };
}) {
  const isNativeQuote = launch.quoteAsset === "0x0000000000000000000000000000000000000000";
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
            <dd className="tabular">{formatQuoteAmount(launch.realQuoteReserve, isNativeQuote ? "ETH" : "")}</dd>
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
            {isNativeQuote
              ? "Paired with ETH"
              : market?.state === "PAIR_AVAILABLE"
                ? `Paired with ${market.company.companyName} Stock Token`
                : "Paired with a Stock Token"}
            {" · "}
            {relativeAge(launch.launchedAt)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
