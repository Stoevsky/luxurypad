import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveExpectedDomains, verifySiwe } from "@/lib/auth/siwe";
import {
  NONCE_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed login request." }, { status: 400 });
  }

  // The nonce must have been issued by us, to this browser, and not yet used.
  const expectedNonce = req.cookies.get(NONCE_COOKIE)?.value;
  if (!expectedNonce) {
    return NextResponse.json(
      { error: "This login request has expired. Please try again." },
      { status: 400 },
    );
  }

  const expected = resolveExpectedDomains({
    configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin: req.nextUrl.origin,
    isProduction: process.env.NODE_ENV === "production",
  });
  if (!expected.ok) {
    // A misconfigured canonical URL is our fault, not the user's, and it
    // disables domain binding — so refuse to issue a session at all.
    console.error(`SIWE domain binding unavailable: ${expected.reason}`);
    return NextResponse.json({ error: "Sign-in is unavailable right now." }, { status: 500 });
  }

  const result = await verifySiwe({
    message: parsed.data.message,
    signature: parsed.data.signature,
    expectedNonce,
    expectedDomains: expected.domains,
  });

  if (!result.ok) {
    const res = NextResponse.json({ error: result.reason }, { status: 401 });
    res.cookies.delete(NONCE_COOKIE); // burn the nonce on failure too
    return res;
  }

  const token = await createSessionToken({
    address: result.address,
    chainId: result.chainId,
    issuedAt: Math.floor(Date.now() / 1000),
  });

  const res = NextResponse.json({
    address: result.address,
    chainId: result.chainId,
  });
  res.cookies.delete(NONCE_COOKIE); // one-time use
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
