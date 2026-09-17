import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAddress, zeroAddress, type Address } from "viem";
import { preflightLaunch } from "@/lib/pons/launch";
import { requireSession } from "@/lib/auth/session";
import { getStockTokenRegistry } from "@/lib/registry/stock-tokens";
import { toJson } from "@/lib/json";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(48),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[A-Za-z0-9]+$/, "Ticker must be letters and numbers only."),
  description: z.string().trim().max(600).default(""),
  imageUri: z.string().trim().max(400).default(""),
  website: z.string().trim().max(200).optional(),
  x: z.string().trim().max(200).optional(),
  telegram: z.string().trim().max(200).optional(),
  quoteAsset: z.string().refine(isAddress, "Invalid pair asset."),
  creatorTaxBps: z.number().int().min(0).max(1000),
  initialBuy: z.string().regex(/^\d+$/).default("0"),
  minAmountOut: z.string().regex(/^\d+$/).default("0"),
});

export async function POST(req: NextRequest) {
  // A connected wallet is not enough — the creator must hold a verified session.
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Sign in with your wallet to launch." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check your launch details." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // The pair asset must be native ETH or a real asset from the live registry.
  // Never trust a client-supplied token address.
  if (body.quoteAsset.toLowerCase() !== zeroAddress) {
    const registry = await getStockTokenRegistry();
    if (!registry) {
      return NextResponse.json(
        { error: "The asset registry is unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    const known = registry.some(
      (a) => a.address.toLowerCase() === body.quoteAsset.toLowerCase(),
    );
    if (!known) {
      return NextResponse.json(
        { error: "That pair asset is not a recognised Stock Token." },
        { status: 400 },
      );
    }
  }

  try {
    const result = await preflightLaunch({
      name: body.name,
      symbol: body.symbol.toUpperCase(),
      imageUri: body.imageUri,
      description: body.description,
      website: body.website,
      x: body.x,
      telegram: body.telegram,
      creator: session.address as Address,
      creatorTaxBps: body.creatorTaxBps,
      quoteAsset: body.quoteAsset as Address,
      initialBuy: BigInt(body.initialBuy),
      minAmountOut: BigInt(body.minAmountOut),
    });
    return NextResponse.json(toJson(result));
  } catch {
    return NextResponse.json(
      { error: "We couldn't prepare this launch. Please try again." },
      { status: 502 },
    );
  }
}
