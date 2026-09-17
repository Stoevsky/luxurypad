import Link from "next/link";
import Image from "next/image";
import { sectorTexture } from "@/lib/registry/sector-art";
import { SECTOR_LABELS, type LuxurySector } from "@/lib/registry/luxury";

/**
 * One luxury sector, as a textured tile.
 *
 * The texture is decorative: `alt=""` and the sector name is real text, so the
 * tile still reads correctly if the image fails, is blocked, or is not
 * perceived. A sector with no artwork falls back to flat ground rather than a
 * broken frame.
 */
export function SectorTile({ sector, count }: { sector: LuxurySector; count: number }) {
  const texture = sectorTexture(sector);
  return (
    <Link
      href={`/markets#${sector}`}
      className="group relative block overflow-hidden border border-line transition-colors duration-200 hover:border-gold"
    >
      <div className="relative aspect-[5/3]">
        {texture ? (
          <Image
            src={texture}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-ground" />
        )}
        {/* Scrim: keeps the label legible over any texture, light or dark. */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/5" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <p className="display text-[17px] leading-tight text-ground">{SECTOR_LABELS[sector]}</p>
          {/* A bare numeral is meaningless read aloud, so name the unit for
              assistive technology while keeping the visual uncluttered. */}
          <p className="tabular shrink-0 text-[12px] text-ground/75">
            {count}
            <span className="sr-only"> {count === 1 ? "company" : "companies"}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
