import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress, type Address } from "viem";
import { Container, Eyebrow, Card, Rule, Progress, Stat } from "@/components/ui";
import { scanLaunches, listLaunches } from "@/lib/indexer/launches";
import { readCurveState } from "@/lib/pons/curve";
import { explorerAddress } from "@/lib/chain/robinhood";
import { formatQuoteAmount, shortAddress } from "@/lib/format";
import { CreatorEarnings } from "@/components/creator-earnings";
import { toJson } from "@/lib/json";

export const revalidate = 30;

type Props = { params: Promise<{ handle: string }> };

/** Profiles live at /@<address>. Anything else is a 404, not a guess. */
function parseHandle(handle: string): Address | null {
  const decoded = decodeURIComponent(handle);
  if (!decoded.startsWith("@")) return null;
  const rest = decoded.slice(1);
  return isAddress(rest) ? (rest as Address) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const address = parseHandle(handle);
  if (!address) return { title: "Profile" };
  return {
    title: `${shortAddress(address)} — Creator`,
    description: `Launches and creator earnings for ${address} on LuxuryPad.`,
    alternates: { canonical: `/@${address}` },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const address = parseHandle(handle);
  if (!address) notFound();

  const [all, hydrated] = await Promise.all([
    scanLaunches().catch(() => []),
    listLaunches(48).catch(() => []),
  ]);

  const mine = all.filter((l) => l.creator.toLowerCase() === address.toLowerCase());
  const mineHydrated = hydrated.filter((l) => l.creator.toLowerCase() === address.toLowerCase());

  // Creator tax accrues per curve, denominated in that curve's pair asset.
  const earnings = await Promise.all(
    mine.slice(0, 12).map(async (l) => {
      try {
        const state = await readCurveState(l.curve);
        return {
          curve: l.curve,
          token: l.token,
          balance: state.creatorTaxBalance.toString(),
          isNativeQuote: state.isNativeQuote,
          quoteAsset: state.quoteAsset,
        };
      } catch {
        return null;
      }
    }),
  );

  return (
    <Container className="py-14 sm:py-20">
      <header className="space-y-3">
        <Eyebrow>Creator</Eyebrow>
        <h1 className="display break-all text-[clamp(1.8rem,4.5vw,2.6rem)]">{shortAddress(address)}</h1>
        <a
          href={explorerAddress(address)}
          target="_blank"
          rel="noreferrer noopener"
          className="tabular block break-all text-[12px] text-muted underline decoration-line underline-offset-4 hover:decoration-gold"
        >
          {address}
        </a>
      </header>

      <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-3">
        <div className="bg-card p-5">
          <Stat label="Launches">{mine.length}</Stat>
        </div>
        <div className="bg-card p-5">
          <Stat label="Graduated">{mineHydrated.filter((l) => l.phase === "graduated").length}</Stat>
        </div>
        <div className="bg-card p-5">
          <Stat label="On the curve">{mineHydrated.filter((l) => l.phase !== "graduated").length}</Stat>
        </div>
      </div>

      <CreatorEarnings
        address={address}
        entries={toJson(earnings.filter((e): e is NonNullable<typeof e> => e !== null))}
      />

      <section className="mt-14">
        <h2 className="display text-[24px]">Launches</h2>
        {mineHydrated.length === 0 ? (
          <Card className="mt-5 p-8 text-center text-[13px] text-muted">
            No launches from this address in the indexed window.
          </Card>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mineHydrated.map((l) => (
              <Link key={l.token} href={`/token/${l.token}`} className="block">
                <Card interactive className="flex h-full flex-col gap-4 p-5">
                  <div>
                    <p className="display truncate text-[19px]">{l.name}</p>
                    <p className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
                      ${l.symbol}
                    </p>
                  </div>
                  <div className="mt-auto space-y-2">
                    <Progress value={l.progress} label={`${Math.round(l.progress * 100)}% to graduation`} />
                    <p className="tabular text-[11px] text-muted">
                      {formatQuoteAmount(l.realQuoteReserve, l.quoteAsset === "0x0000000000000000000000000000000000000000" ? "ETH" : "")}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Rule className="mt-14" />
      <p className="mt-6 text-[11px] leading-relaxed text-muted">
        Launch counts are read from the Pons factory over the indexed block window and reflect chain
        state, not self-reported activity.
      </p>
    </Container>
  );
}
