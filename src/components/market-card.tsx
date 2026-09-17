import Link from "next/link";
import Image from "next/image";
import { Card, StatePill, Unavailable } from "@/components/ui";
import { relationshipLabel, type LuxuryMarket } from "@/lib/registry/resolve";
import { SECTOR_LABELS } from "@/lib/registry/luxury";

export function MarketCard({ market }: { market: LuxuryMarket }) {
  const { company, asset, quote, state } = market;
  const href = asset ? `/market/${asset.symbol}` : `/themes/${company.id}`;

  return (
    <Link href={href} className="group block">
      <Card interactive className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {asset?.logoUrl ? (
              <Image
                src={asset.logoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full border border-line object-cover"
                unoptimized
              />
            ) : (
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-ground display text-[15px]"
              >
                {company.companyName.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <p className="display truncate text-[19px] leading-tight">{company.companyName}</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
                {asset ? asset.symbol : SECTOR_LABELS[company.sector]}
              </p>
            </div>
          </div>
          <StatePill state={state} />
        </div>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">{company.note}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            <p className="eyebrow">Reference price</p>
            <p className="tabular text-[15px]">
              {quote ? `$${quote.ask.toFixed(2)}` : <Unavailable hint="Reference price unavailable" />}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">{company.country}</p>
            <p className="text-[12px] text-muted">{SECTOR_LABELS[company.sector]}</p>
          </div>
        </div>

        {/* The pairing claim. Only ever "Paired with" for a verified pair. */}
        <p className="border-t border-line pt-3 text-[11px] text-muted">{relationshipLabel(market)}</p>
      </Card>
    </Link>
  );
}
