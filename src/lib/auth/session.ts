import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Address } from "viem";

/**
 * Session handling for Sign-In with Ethereum.
 *
 * A connected wallet is NOT authentication. A session only exists after the
 * server has verified an EIP-4361 signature over a nonce it issued itself.
 */
export const SESSION_COOKIE = "luxurypad_session";
export const NONCE_COOKIE = "luxurypad_nonce";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes

export type Session = {
  address: Address;
  chainId: number;
  issuedAt: number;
};

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ address: session.address, chainId: session.chainId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.address.toLowerCase())
    .setIssuedAt(session.issuedAt)
    .setExpirationTime(session.issuedAt + SESSION_TTL_SECONDS)
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const address = payload.address;
    const chainId = payload.chainId;
    if (typeof address !== "string" || typeof chainId !== "number") return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
    return { address: address as Address, chainId, issuedAt: Number(payload.iat ?? 0) };
  } catch {
    return null;
  }
}

/** The authenticated session for the current request, or null. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

/** Throws when unauthenticated — for API routes that mutate user data. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const error = new Error("Authentication required.");
    error.name = "UnauthorizedError";
    throw error;
  }
  return session;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export const nonceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: NONCE_TTL_SECONDS,
};
