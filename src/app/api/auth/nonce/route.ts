import { NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth/siwe";
import { NONCE_COOKIE, nonceCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Issues a single-use nonce bound to this browser via an httpOnly cookie. */
export async function GET() {
  const nonce = generateNonce();
  const res = NextResponse.json({ nonce });
  res.cookies.set(NONCE_COOKIE, nonce, nonceCookieOptions);
  return res;
}
