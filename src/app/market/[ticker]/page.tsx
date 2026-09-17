import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container, Eyebrow, Card, ButtonLink, StatePill, Stat, Unavailable, Rule, Progress } from "@/components/ui";
import { resolveLuxuryMarkets, relationshipLabel } from "@/lib/registry/resolve";
import { SECTOR_LABELS } from "@/lib/registry/luxury";
import { listLaunches } from "@/lib/indexer/launches";
import { explorerAddress } from "@/lib/chain/robinhood";
import { shortAddress } from "@/lib/format";

export const revalidate = 60;

type Props = { params: Promise<{ ticker: string }> };

async function findMarket(ticker: string) {
  const { markets } = await resolveLuxuryMarkets();
  return markets.find((m) => m.asset?.symbol.toUpperCase() === ticker.toUpperCase()) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const market = await findMarket(ticker).catch(() => null);
  if (!market) return { title: ticker.toUpperCase() };
  return {
    title: `${market.company.companyName} (${market.asset!.symbol})`,
    description: `${relationshipLabel(market)}. ${market.company.note}`,
    alternates: { canonical: `/market/${market.asset!.symbol}` },
  };
}

export default async function MarketPage({ params }: Props) {
  const { ticker } = await params;
  const market = await findMarket(ticker);
  if (!market) notFound();

  const { company, asset, quote, state, launchable } = market;
  const launches = await listLaunches(48).catch(() => []);
  const related = launches.filter(
    (l) => l.quoteAsset.toLowerCase() === asset!.address.toLowerCase(),
  );

  return (
    <Container className="py-14 sm:py-20">
      <Link href="/markets" className="text-[13px] text-muted hover:text-ink">
        ← Markets
      </Link>

      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {asset!.logoUrl ? (
            <Image
              src={asset!.logoUrl}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 rounded-full border border-line object-cover"
            />
          ) : null}
          <div className="space-y-2">
            <Eyebrow>
              {SECTOR_LABELS[company.sector]} · {company.country}
            </Eyebrow>
            <h1 className="display text-[clamp(2.2rem,5vw,3rem)]">{company.companyName}</h1>
            <p className="tabular text-[13px] text-muted">{asset!.symbol}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <StatePill state={state} />
          {launchable ? (
            <ButtonLink href={`/launch?market=${asset!.symbol}`} size="lg">
              Launch with {company.companyName}
            </ButtonLink>
          ) : (
            <p className="max-w-xs text-[12px] leading-relaxed text-muted sm:text-right">
              This luxury market isn&apos;t currently available as a launch pair.
            </p>
          )}
        </div>
      </header>

      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted">{company.note}</p>

      <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <p className="eyebrow">Stock Token</p>
          <Rule className="my-4" />
          <dl className="grid gap-5 sm:grid-cols-2">
            <Stat label="Reference price">
              {quote ? `$${quote.ask.toFixed(2)} ${quote.currency}` : <Unavailable />}
            </Stat>
            <Stat label="Bid / Ask">
              {quote ? `${quote.bid.toFixed(2)} / ${quote.ask.toFixed(2)}` : <Unavailable />}
            </Stat>
            <Stat label="Corporate-action multiplier">{asset!.currentMultiplier}</Stat>
            <Stat label="Network">Robinhood Chain · {asset!.chainId}</Stat>
            <div className="sm:col-span-2">
              <p className="eyebrow">Canonical contract</p>
              <a
                href={explorerAddress(asset!.address)}
                target="_blank"
                rel="noreferrer noopener"
                className="tabular break-all text-[13px] underline decoration-line underline-offset-4 hover:decoration-gold"
              >
                {asset!.address}
              </a>
            </div>
          </dl>
          {quote?.isTradingHalt ? (
            <p className="mt-5 border-t border-line pt-4 text-[12px] text-burgundy">
              The underlying equity currently has an active trading halt.
            </p>
          ) : null}
          <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
            Reference prices are the raw underlying-equity bid/ask and are not multiplier-adjusted.
            {quote ? ` As of ${new Date(quote.generatedAt).toUTCString()}.` : ""}
          </p>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Pairing</p>
          <Rule className="my-4" />
          <p className="text-[15px]">{relationshipLabel(market)}</p>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {launchable
              ? "Verified against the Pons launch contract. Launches quoted in this asset settle in it."
              : "A Stock Token exists for this company, but Pons does not currently accept it as a launch pair."}
          </p>
          {company.officialWebsite ? (
            <>
              <Rule className="my-4" />
              <a
                href={company.officialWebsite}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[13px] text-muted hover:text-ink"
              >
                Official website ↗
              </a>
            </>
          ) : null}
        </Card>
      </div>

      <section className="mt-14">
        <h2 className="display text-[24px]">LuxuryPad launches paired with {company.companyName}</h2>
        {related.length === 0 ? (
          <Card className="mt-5 p-8 text-center text-[13px] text-muted">
            No launches are currently paired with this asset.
          </Card>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((l) => (
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
                  <p className="tabular text-[11px] text-muted">{shortAddress(l.token)}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="mt-12 max-w-3xl text-[11px] leading-relaxed text-muted">
        LuxuryPad launches are independent user-created crypto tokens. They do not represent
        ownership, voting rights, dividends, or claims on {company.companyName}.
      </p>
    </Container>
  );
}
