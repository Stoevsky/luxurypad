import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress, type Address } from "viem";
import { Container, Eyebrow, Card, Rule, Progress, Stat, StatePill } from "@/components/ui";
import { findLaunchByToken } from "@/lib/indexer/launches";
import { readCurveState, readTokenMeta, graduationProgress, phaseOf } from "@/lib/pons/curve";
import { resolveLuxuryMarkets, pairingLabel } from "@/lib/registry/resolve";
import { explorerAddress, explorerTx } from "@/lib/chain/robinhood";
import { formatAmount, formatQuoteAmount, relativeAge, shortAddress } from "@/lib/format";
import { TradePanel } from "@/components/trade-panel";
import { toJson } from "@/lib/json";

export const revalidate = 15;

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  if (!isAddress(address)) return { title: "Launch" };
  const launch = await findLaunchByToken(address as Address).catch(() => null);
  if (!launch) return { title: "Launch" };
  const meta = await readTokenMeta(launch.token).catch(() => null);
  if (!meta) return { title: "Launch" };
  return {
    title: `${meta.name} ($${meta.symbol})`,
    description: `${meta.name} — a LuxuryPad launch on Pons V2, Robinhood Chain.`,
    alternates: { canonical: `/token/${launch.token}` },
    openGraph: { title: `${meta.name} ($${meta.symbol})`, type: "website" },
  };
}

export default async function TokenPage({ params }: Props) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const launch = await findLaunchByToken(address as Address).catch(() => null);
  if (!launch) notFound();

  const [meta, state, { markets }] = await Promise.all([
    readTokenMeta(launch.token),
    readCurveState(launch.curve),
    resolveLuxuryMarkets().catch(() => ({ markets: [] as never[] })),
  ]);

  const market = markets.find(
    (m) => m.asset?.address.toLowerCase() === state.quoteAsset.toLowerCase(),
  );
  const phase = phaseOf(state);
  const progress = graduationProgress(state);
  const quoteSymbol = state.isNativeQuote ? "ETH" : market?.asset?.symbol ?? "";

  // Pairing language is verified, not assumed.
  const pairing = pairingLabel(market, {
    isNativeQuote: state.isNativeQuote,
    fallbackSymbol: quoteSymbol,
  });

  return (
    <Container className="py-14 sm:py-20">
      <Link href="/explore" className="text-[13px] text-muted hover:text-ink">
        ← Explore
      </Link>

      <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Eyebrow>{pairing}</Eyebrow>
          <h1 className="display text-[clamp(2.2rem,5vw,3rem)]">{meta.name}</h1>
          <p className="tabular text-[13px] text-muted">
            ${meta.symbol} · created by{" "}
            <Link href={`/@${state.creator}`} className="underline decoration-line underline-offset-4 hover:decoration-gold">
              {shortAddress(state.creator)}
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {market ? <StatePill state={market.state} /> : null}
          <p className="text-[12px] text-muted">
            {phase === "graduated" ? "Graduated" : phase === "ready_to_graduate" ? "Ready to graduate" : "On the curve"}
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="eyebrow">Graduation</p>
              <p className="tabular text-[13px]">
                {formatQuoteAmount(state.realQuoteReserve, quoteSymbol)} /{" "}
                {formatQuoteAmount(state.graduationThreshold, quoteSymbol)}
              </p>
            </div>
            <div className="mt-4">
              <Progress value={progress} label={`${Math.round(progress * 100)}% to graduation`} />
            </div>
            {phase === "graduated" ? (
              <p className="mt-4 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
                This launch has graduated. Its liquidity was seeded into a Uniswap V4 pool and the
                position is permanently locked.
              </p>
            ) : null}
          </Card>

          <Card className="p-6">
            <p className="eyebrow">Onchain</p>
            <Rule className="my-4" />
            <dl className="grid gap-5 sm:grid-cols-3">
              <Stat label="Total supply">{formatAmount(meta.totalSupply, meta.decimals, 0)}</Stat>
              <Stat label="Sellable on curve">{formatAmount(state.sellableTokens, meta.decimals, 0)}</Stat>
              <Stat label="Creator tax">{(state.creatorTaxBps / 100).toFixed(2)}%</Stat>
              <Stat label="Protocol fee">{(state.feeBps / 100).toFixed(2)}%</Stat>
              <Stat label="Quote reserve">{formatQuoteAmount(state.quoteReserve, quoteSymbol)}</Stat>
              <Stat label="Launched">{relativeAge(state.launchedAt)}</Stat>
            </dl>
            <Rule className="my-5" />
            <div className="space-y-3 text-[13px]">
              <LabelledLink label="Token contract" href={explorerAddress(meta.address)} value={meta.address} />
              <LabelledLink label="Bonding curve" href={explorerAddress(state.curve)} value={state.curve} />
              <LabelledLink label="Launch transaction" href={explorerTx(launch.txHash)} value={launch.txHash} />
            </div>
            <p className="mt-5 border-t border-line pt-4 text-[11px] text-muted tabular">
              Indexed from {launch.protocolVersion} factory {shortAddress(launch.factory)} at block{" "}
              {launch.blockNumber.toString()}
            </p>
          </Card>
        </div>

        <TradePanel
          token={meta.address}
          tokenSymbol={meta.symbol}
          tokenDecimals={meta.decimals}
          curve={state.curve}
          quoteSymbol={quoteSymbol || "quote"}
          isNativeQuote={state.isNativeQuote}
          phase={phase}
          creatorTaxBps={state.creatorTaxBps}
          feeBps={state.feeBps}
          state={toJson({ snipeTaxStartBps: state.snipeTaxStartBps, snipeTaxSeconds: state.snipeTaxSeconds })}
        />
      </div>

      <p className="mt-12 max-w-3xl text-[11px] leading-relaxed text-muted">
        LuxuryPad launches are independent user-created crypto tokens. They do not represent
        ownership, voting rights, dividends, or claims on the referenced companies.
      </p>
    </Container>
  );
}

function LabelledLink({ label, href, value }: { label: string; href: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="tabular break-all underline decoration-line underline-offset-4 hover:decoration-gold"
      >
        {value}
      </a>
    </div>
  );
}
