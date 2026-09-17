import Link from "next/link";
import { Container, Rule } from "@/components/ui";
import { ACTIVE_DEPLOYMENT, APP_CHAIN_ID } from "@/lib/pons/deployment";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-3">
            <p className="display text-[20px]">LuxuryPad</p>
            <p className="text-[13px] leading-relaxed text-muted">
              Luxury, launched onchain. LuxuryPad is a discovery and launch interface for the Pons V2
              protocol on Robinhood Chain.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[13px]">
            <Link href="/markets" className="text-muted hover:text-ink">Markets</Link>
            <Link href="/explore" className="text-muted hover:text-ink">Explore</Link>
            <Link href="/themes" className="text-muted hover:text-ink">Themes</Link>
            <Link href="/launch" className="text-muted hover:text-ink">Launch</Link>
          </div>
        </div>

        <Rule className="my-8" />

        {/* Required disclosure. Never hidden, never collapsed. */}
        <p className="max-w-3xl text-[12px] leading-relaxed text-muted">
          LuxuryPad launches are independent user-created crypto tokens. They do not represent
          ownership, voting rights, dividends, or claims on the referenced companies. Referenced
          company names and trademarks belong to their respective owners and imply no affiliation,
          endorsement or partnership.
        </p>
        <p className="mt-4 text-[11px] text-muted tabular">
          {ACTIVE_DEPLOYMENT
            ? `${ACTIVE_DEPLOYMENT.protocolVersion} · factory ${ACTIVE_DEPLOYMENT.launchFactory.slice(0, 10)}… · chain ${ACTIVE_DEPLOYMENT.chainId}`
            : `No Pons deployment configured for chain ${APP_CHAIN_ID} — launching is disabled.`}
        </p>
      </Container>
    </footer>
  );
}
