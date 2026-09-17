/**
 * LuxuryAssetRegistry — the curated editorial layer.
 *
 * IMPORTANT, AND THE WHOLE POINT OF THIS FILE:
 * Nothing here asserts that a company is launchable. These records carry only
 * editorial metadata (sector, country, website). Whether a company can be used
 * as a launch pair is decided at runtime by intersecting this list with
 *   (a) the live Robinhood Stock Token registry, and
 *   (b) a real Pons `launchToken` simulation against the pair allowlist.
 * See `resolveLuxuryMarkets()` in ./resolve.ts.
 *
 * A record with no `stockTicker` has NO tokenized equity and can never be more
 * than a theme. It must never be described as "paired with".
 */

export type LuxurySector =
  | "fashion"
  | "automotive"
  | "watches"
  | "jewelry"
  | "beauty"
  | "hospitality"
  | "consumer"
  | "conglomerate"
  | "materials"
  | "other";

export type LuxuryCompany = {
  id: string;
  companyName: string;
  /** Ticker of the tokenized equity, if one plausibly exists. Verified at runtime. */
  stockTicker?: string;
  sector: LuxurySector;
  country: string;
  officialWebsite?: string;
  /** One-line editorial description. Never a claim about availability. */
  note: string;
  enabled: boolean;
};

export const LUXURY_COMPANIES: LuxuryCompany[] = [
  // ——— Candidates with a tokenized equity that may exist on Robinhood Chain ———
  {
    id: "lululemon",
    companyName: "Lululemon",
    stockTicker: "LULU",
    sector: "fashion",
    country: "Canada",
    officialWebsite: "https://shop.lululemon.com",
    note: "Premium technical apparel; the defining name in elevated athleisure.",
    enabled: true,
  },
  {
    id: "tesla",
    companyName: "Tesla",
    stockTicker: "TSLA",
    sector: "automotive",
    country: "United States",
    officialWebsite: "https://www.tesla.com",
    note: "Premium electric performance vehicles.",
    enabled: true,
  },
  {
    id: "rivian",
    companyName: "Rivian",
    stockTicker: "RIVN",
    sector: "automotive",
    country: "United States",
    officialWebsite: "https://rivian.com",
    note: "Premium electric adventure vehicles.",
    enabled: true,
  },
  {
    id: "gold",
    companyName: "Gold",
    stockTicker: "GLD",
    sector: "materials",
    country: "Global",
    officialWebsite: "https://www.spdrgoldshares.com",
    note: "The underlying material of fine jewellery and haute horlogerie.",
    enabled: true,
  },
  {
    id: "silver",
    companyName: "Silver",
    stockTicker: "SLV",
    sector: "materials",
    country: "Global",
    officialWebsite: "https://www.ishares.com",
    note: "Silver as a precious-metals benchmark for jewellery and watchmaking.",
    enabled: true,
  },
  {
    id: "elf-beauty",
    companyName: "e.l.f. Beauty",
    stockTicker: "ELF",
    sector: "beauty",
    country: "United States",
    officialWebsite: "https://www.elfbeauty.com",
    note: "Colour cosmetics and skincare.",
    enabled: true,
  },
  {
    id: "carnival",
    companyName: "Carnival Corporation",
    stockTicker: "CCL",
    sector: "hospitality",
    country: "United States",
    officialWebsite: "https://www.carnivalcorp.com",
    note: "Global cruise and leisure travel operator.",
    enabled: true,
  },

  // ——— Iconic houses with NO tokenized equity in the connected ecosystem ———
  // These exist here as themes only. They are never launch pairs.
  {
    id: "ferrari",
    companyName: "Ferrari",
    sector: "automotive",
    country: "Italy",
    officialWebsite: "https://www.ferrari.com",
    note: "Maranello. The reference point for the modern supercar.",
    enabled: true,
  },
  {
    id: "lvmh",
    companyName: "LVMH",
    sector: "conglomerate",
    country: "France",
    officialWebsite: "https://www.lvmh.com",
    note: "The largest luxury group in the world.",
    enabled: true,
  },
  {
    id: "hermes",
    companyName: "Hermès",
    sector: "fashion",
    country: "France",
    officialWebsite: "https://www.hermes.com",
    note: "Leather, silk and an unmatched study in scarcity.",
    enabled: true,
  },
  {
    id: "kering",
    companyName: "Kering",
    sector: "conglomerate",
    country: "France",
    officialWebsite: "https://www.kering.com",
    note: "Gucci, Saint Laurent, Bottega Veneta and Balenciaga.",
    enabled: true,
  },
  {
    id: "richemont",
    companyName: "Richemont",
    sector: "watches",
    country: "Switzerland",
    officialWebsite: "https://www.richemont.com",
    note: "Cartier, Van Cleef & Arpels, IWC and Jaeger-LeCoultre.",
    enabled: true,
  },
  {
    id: "moncler",
    companyName: "Moncler",
    sector: "fashion",
    country: "Italy",
    officialWebsite: "https://www.moncler.com",
    note: "Alpine outerwear turned luxury house.",
    enabled: true,
  },
  {
    id: "porsche",
    companyName: "Porsche",
    sector: "automotive",
    country: "Germany",
    officialWebsite: "https://www.porsche.com",
    note: "Stuttgart engineering, six decades of the 911.",
    enabled: true,
  },
  {
    id: "burberry",
    companyName: "Burberry",
    sector: "fashion",
    country: "United Kingdom",
    officialWebsite: "https://www.burberry.com",
    note: "British heritage outerwear.",
    enabled: true,
  },
  {
    id: "prada",
    companyName: "Prada",
    sector: "fashion",
    country: "Italy",
    officialWebsite: "https://www.prada.com",
    note: "Milanese intellectual luxury.",
    enabled: true,
  },
  {
    id: "swatch-group",
    companyName: "Swatch Group",
    sector: "watches",
    country: "Switzerland",
    officialWebsite: "https://www.swatchgroup.com",
    note: "Omega, Breguet, Blancpain and Longines.",
    enabled: true,
  },
  {
    id: "estee-lauder",
    companyName: "Estée Lauder",
    sector: "beauty",
    country: "United States",
    officialWebsite: "https://www.elcompanies.com",
    note: "Prestige beauty across La Mer, Jo Malone and Tom Ford Beauty.",
    enabled: true,
  },
];

export const SECTOR_LABELS: Record<LuxurySector, string> = {
  fashion: "Fashion Houses",
  automotive: "Supercars & Motoring",
  watches: "Watches",
  jewelry: "Jewellery",
  beauty: "Premium Beauty",
  hospitality: "Hospitality",
  consumer: "Consumer Luxury",
  conglomerate: "Luxury Conglomerates",
  materials: "Precious Materials",
  other: "Other",
};

export const SECTOR_ORDER: LuxurySector[] = [
  "fashion",
  "automotive",
  "watches",
  "jewelry",
  "materials",
  "beauty",
  "hospitality",
  "conglomerate",
  "consumer",
  "other",
];
