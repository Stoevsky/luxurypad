import type { LuxurySector } from "./luxury";

/**
 * Curated themes. A theme is editorial grouping only — membership never implies
 * that any company in it can be used as a launch pair.
 */
export type Theme = {
  id: string;
  title: string;
  blurb: string;
  /** Companies are matched by id; sectors broaden the net. */
  companyIds: string[];
  sectors?: LuxurySector[];
};

export const THEMES: Theme[] = [
  {
    id: "italian-luxury",
    title: "Italian Luxury",
    blurb: "Maranello, Milan and the houses that made Italian craft a global language.",
    companyIds: ["ferrari", "moncler", "prada"],
  },
  {
    id: "french-fashion",
    title: "French Fashion",
    blurb: "The Paris groups that define modern luxury at scale.",
    companyIds: ["lvmh", "hermes", "kering"],
  },
  {
    id: "supercars",
    title: "Supercars",
    blurb: "Performance as an object of desire.",
    companyIds: ["ferrari", "porsche", "tesla", "rivian"],
    sectors: ["automotive"],
  },
  {
    id: "watches",
    title: "Watches",
    blurb: "Swiss movements, heritage maisons and the materials behind them.",
    companyIds: ["richemont", "swatch-group", "gold"],
    sectors: ["watches"],
  },
  {
    id: "luxury-beauty",
    title: "Luxury Beauty",
    blurb: "Prestige beauty and the margins that fund the rest of luxury.",
    companyIds: ["estee-lauder", "elf-beauty"],
    sectors: ["beauty"],
  },
  {
    id: "premium-travel",
    title: "Premium Travel",
    blurb: "Hospitality, cruising and the business of going somewhere well.",
    companyIds: ["carnival"],
    sectors: ["hospitality"],
  },
  {
    id: "heritage-brands",
    title: "Heritage Brands",
    blurb: "Houses measured in centuries rather than quarters.",
    companyIds: ["hermes", "burberry", "richemont", "porsche"],
  },
  {
    id: "modern-luxury",
    title: "Modern Luxury",
    blurb: "The new premium: technical apparel, electric performance, direct retail.",
    companyIds: ["lululemon", "tesla", "rivian"],
  },
  {
    id: "precious-materials",
    title: "Precious Materials",
    blurb: "Gold and silver — the raw inputs of jewellery and haute horlogerie.",
    companyIds: ["gold", "silver"],
    sectors: ["materials"],
  },
];

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? null;
