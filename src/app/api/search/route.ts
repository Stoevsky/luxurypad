import { NextResponse, type NextRequest } from "next/server";
import { resolveLuxuryMarkets } from "@/lib/registry/resolve";
import { listLaunches } from "@/lib/indexer/launches";
import { THEMES } from "@/lib/registry/themes";

export const revalidate = 30;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return NextResponse.json({ results: [] });

  const [{ markets }, launches] = await Promise.all([
    resolveLuxuryMarkets().catch(() => ({ markets: [] as never[] })),
    listLaunches(40).catch(() => []),
  ]);

  const results = [
    ...markets
      .filter(
        (m) =>
          m.company.companyName.toLowerCase().includes(q) ||
          (m.company.stockTicker ?? "").toLowerCase().includes(q),
      )
      .map((m) => ({
        kind: "market" as const,
        title: m.company.companyName,
        subtitle: m.asset ? m.asset.symbol : "Theme",
        href: m.asset ? `/market/${m.asset.symbol}` : `/themes/${m.company.id}`,
      })),
    ...launches
      .filter((l) => l.name.toLowerCase().includes(q) || l.symbol.toLowerCase().includes(q))
      .map((l) => ({
        kind: "launch" as const,
        title: l.name,
        subtitle: `$${l.symbol}`,
        href: `/token/${l.token}`,
      })),
    ...THEMES.filter((t) => t.title.toLowerCase().includes(q)).map((t) => ({
      kind: "theme" as const,
      title: t.title,
      subtitle: "Theme",
      href: `/themes/${t.id}`,
    })),
  ].slice(0, 12);

  return NextResponse.json({ results });
}
