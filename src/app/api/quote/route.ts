import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAddress, type Address } from "viem";
import { readCurveState, phaseOf } from "@/lib/pons/curve";
import { quoteBuy, quoteSell } from "@/lib/pons/quote";
import { findLaunchByToken } from "@/lib/indexer/launches";
import { toJson } from "@/lib/json";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().refine(isAddress),
  side: z.enum(["buy", "sell"]),
  amount: z.string().regex(/^\d+$/),
  slippageBps: z.number().int().min(0).max(5000).default(100),
  account: z.string().refine(isAddress).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
  const { token, side, amount, slippageBps, account } = parsed.data;

  // Resolve the curve from the factory's own logs — never from the client.
  const launch = await findLaunchByToken(token as Address).catch(() => null);
  if (!launch) {
    return NextResponse.json({ error: "We couldn't find this launch onchain." }, { status: 404 });
  }

  try {
    const state = await readCurveState(launch.curve);
    const phase = phaseOf(state);

    // Phase drives execution path. Never quote curve prices for a graduated token.
    if (phase === "graduated") {
      return NextResponse.json(
        {
          error:
            "This launch has graduated. Trading now routes through its Uniswap V4 pool rather than the curve.",
          phase,
        },
        { status: 409 },
      );
    }

    const amountIn = BigInt(amount);
    if (amountIn <= 0n) return NextResponse.json({ error: "Enter an amount." }, { status: 400 });

    const quote =
      side === "buy"
        ? await quoteBuy(state, amountIn, slippageBps, account as Address | undefined)
        : await quoteSell(state, amountIn, slippageBps, account as Address | undefined);

    return NextResponse.json(
      toJson({ quote, phase, curve: state.curve, quoteAsset: state.quoteAsset, isNativeQuote: state.isNativeQuote }),
    );
  } catch {
    return NextResponse.json({ error: "Chain data is temporarily unavailable." }, { status: 503 });
  }
}
