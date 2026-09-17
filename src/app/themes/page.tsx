import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Card } from "@/components/ui";
import { THEMES } from "@/lib/registry/themes";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Themes",
  description: "Curated luxury-market themes on LuxuryPad.",
};

export default async function ThemesPage() {
  const { markets } = await resolveLuxuryMarkets().catch(() => ({ markets: [] as never[] }));

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <Eyebrow>Themes</Eyebrow>
        <h1 className="display text-[clamp(2.4rem,5.5vw,3.4rem)]">Narratives, not just tickers.</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Themes are editorial groupings. Membership never implies a company can be used as a launch
          pair.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => {
          const members = markets.filter((m) => t.companyIds.includes(m.company.id));
          const launchable = members.filter((m) => m.launchable).length;
          return (
            <Link key={t.id} href={`/themes/${t.id}`} className="block">
              <Card interactive className="flex h-full flex-col gap-3 p-5">
                <p className="display text-[21px]">{t.title}</p>
                <p className="text-[13px] leading-relaxed text-muted">{t.blurb}</p>
                <p className="mt-auto pt-3 text-[11px] uppercase tracking-[0.12em] text-muted">
                  {members.length} {members.length === 1 ? "company" : "companies"} ·{" "}
                  {launchable} launchable
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
