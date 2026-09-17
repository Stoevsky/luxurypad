import type { Metadata } from "next";
import { Container, Eyebrow, Card } from "@/components/ui";
import { MarketCard } from "@/components/market-card";
import { resolveLuxuryMarkets, groupBySector } from "@/lib/registry/resolve";
import { SECTOR_LABELS, SECTOR_ORDER } from "@/lib/registry/luxury";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Markets",
  description: "Supported luxury companies and luxury-market assets on LuxuryPad.",
};

export default async function MarketsPage() {
  const { markets, registryUnavailable, pairCheckUnavailable, resolvedAt } = await resolveLuxuryMarkets();
  const grouped = groupBySector(markets);
  const launchable = markets.filter((m) => m.launchable).length;
  const discovery = markets.filter((m) => m.state === "DISCOVERY_ONLY").length;
  const theme = markets.filter((m) => m.state === "THEME_ONLY").length;

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <Eyebrow>Markets</Eyebrow>
        <h1 className="display text-[clamp(2.4rem,5.5vw,3.4rem)]">
          The luxury markets we can actually reach.
        </h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Each company below is checked against the live Stock Token registry and the Pons launch
          contract. Only a verified pair can be used to launch.
        </p>
      </div>

      {/* Honest counts, including the gap. */}
      <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-3">
        {[
          { k: "Pair available", v: launchable, d: "Usable as a real launch pair." },
          { k: "Discovery only", v: discovery, d: "Tokenised, but not an approved pair." },
          { k: "Theme", v: theme, d: "No tokenised equity in this ecosystem." },
        ].map((s) => (
          <div key={s.k} className="bg-card p-5">
            <p className="eyebrow">{s.k}</p>
            <p className="tabular display mt-1 text-[30px]">{s.v}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{s.d}</p>
          </div>
        ))}
      </div>

      {registryUnavailable ? (
        <Card className="mt-6 p-4 text-[13px] text-burgundy">
          The Stock Token registry is unavailable, so pairing cannot be confirmed right now.
        </Card>
      ) : null}
      {pairCheckUnavailable ? (
        <Card className="mt-6 p-4 text-[13px] text-burgundy">
          Pair verification is unavailable. Companies are shown as discovery-only until it recovers.
        </Card>
      ) : null}

      {SECTOR_ORDER.filter((s) => grouped.has(s)).map((sector) => (
        <section key={sector} id={sector} className="mt-14 scroll-mt-24">
          <h2 className="display text-[24px]">{SECTOR_LABELS[sector]}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.get(sector)!.map((m) => (
              <MarketCard key={m.company.id} market={m} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-14 text-[11px] text-muted tabular">
        Resolved {new Date(resolvedAt).toUTCString()}
      </p>
    </Container>
  );
}
