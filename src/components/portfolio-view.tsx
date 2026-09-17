"use client";

import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { useSession } from "@/lib/auth/use-auth";
import { formatAmount, shortAddress } from "@/lib/format";

export function PortfolioView() {
  const { address, isConnected } = useAccount();
  const { data: session } = useSession();
  const balance = useBalance({ address });

  if (!isConnected || !address) {
    return <p className="text-[13px] text-muted">Connect a wallet to see your portfolio.</p>;
  }

  if (!session) {
    return (
      <p className="text-[13px] text-muted">
        Sign in with your wallet to see your launches and creator earnings.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">Wallet</p>
        <Link href={`/@${address}`} className="tabular text-[13px] underline decoration-line underline-offset-4 hover:decoration-gold">
          {shortAddress(address)}
        </Link>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">ETH balance</p>
        <p className="tabular text-[15px]">
          {balance.data ? `${formatAmount(balance.data.value, 18)} ETH` : "Unavailable"}
        </p>
      </div>
      <div className="border-t border-line pt-5">
        <Link href={`/@${address}`} className="text-[13px] underline decoration-line underline-offset-4 hover:decoration-gold">
          View your launches and creator earnings →
        </Link>
      </div>
    </div>
  );
}
