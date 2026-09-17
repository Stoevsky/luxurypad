import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Eyebrow, Card, Progress } from "@/components/ui";
import { MarketCard } from "@/components/market-card";
import { getTheme } from "@/lib/registry/themes";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";
import { listLaunches } from "@/lib/indexer/launches";

export const revalidate = 120;

/**
 * Deliberately not prerendered. Every theme page reads live registry, pair and
 * curve state; prerendering nine of them in parallel at build time hammers a
 * rate-limited public RPC to produce HTML that is stale by the time it ships.
 * They are server-rendered on demand and cached by ISR instead.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const theme = getTheme(id);
  if (!theme) return { title: "Theme" };
  return {
    title: theme.title,
    description: theme.blurb,
    alternates: { canonical: `/themes/${theme.id}` },
  };
}

export default async function ThemePage({ params }: Props) {
  const { id } = await params;
  const theme = getTheme(id);
  if (!theme) notFound();

  const [{ markets }, launches] = await Promise.all([
    resolveLuxuryMarkets().catch(() => ({ markets: [] as never[] })),
    listLaunches(48).catch(() => []),
  ]);

  const members = markets.filter(
    (m) => theme.companyIds.includes(m.company.id) || theme.sectors?.includes(m.company.sector),
  );
  const memberAssets = new Set(
    members.filter((m) => m.asset).map((m) => m.asset!.address.toLowerCase()),
  );
  const themeLaunches = launches.filter((l) => memberAssets.has(l.quoteAsset.toLowerCase()));

  return (
    <Container className="py-14 sm:py-20">
      <Link href="/themes" className="text-[13px] text-muted hover:text-ink">
        ← Themes
      </Link>
      <div className="mt-6 max-w-2xl space-y-4">
        <Eyebrow>Theme</Eyebrow>
        <h1 className="display text-[clamp(2.2rem,5vw,3rem)]">{theme.title}</h1>
        <p className="text-[15px] leading-relaxed text-muted">{theme.blurb}</p>
      </div>

      <section className="mt-12">
        <h2 className="display text-[24px]">Companies</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MarketCard key={m.company.id} market={m} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="display text-[24px]">Launches in this theme</h2>
        {themeLaunches.length === 0 ? (
          <Card className="mt-5 p-8 text-center text-[13px] text-muted">
            No launches are currently paired with assets in this theme.
          </Card>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {themeLaunches.map((l) => (
              <Link key={l.token} href={`/token/${l.token}`} className="block">
                <Card interactive className="flex h-full flex-col gap-4 p-5">
                  <div>
                    <p className="display truncate text-[19px]">{l.name}</p>
                    <p className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
                      ${l.symbol}
                    </p>
                  </div>
                  <div className="mt-auto">
                    <Progress value={l.progress} label={`${Math.round(l.progress * 100)}% to graduation`} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
