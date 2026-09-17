import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";
import { LaunchWizard } from "@/components/launch-wizard";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";
import { toJson } from "@/lib/json";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Launch",
  description: "Launch a token around a supported luxury-market asset.",
};

export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const { market } = await searchParams;
  const { markets, registryUnavailable, pairCheckUnavailable } = await resolveLuxuryMarkets().catch(
    () => ({ markets: [], registryUnavailable: true, pairCheckUnavailable: true, resolvedAt: "" }),
  );

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <Eyebrow>Launch</Eyebrow>
        <h1 className="display text-[clamp(2.4rem,5.5vw,3.4rem)]">What are you launching around?</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Choose a verified pair, describe your token, review the protocol&apos;s live economics, then
          sign.
        </p>
      </div>

      <LaunchWizard
        markets={toJson(markets)}
        preselect={market ?? null}
        degraded={registryUnavailable || pairCheckUnavailable}
      />
    </Container>
  );
}
