import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({
    session: { address: session.address, chainId: session.chainId },
  });
}
