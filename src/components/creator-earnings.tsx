"use client";

import { Card, Rule } from "@/components/ui";
import { useAccount } from "wagmi";
import { formatAmount, shortAddress } from "@/lib/format";
import type { Address } from "viem";

type Entry = {
  curve: Address;
  token: Address;
  balance: string;
  isNativeQuote: boolean;
  quoteAsset: Address;
};

/**
 * Creator earnings, read from each curve's own `creatorTaxBalance`.
 *
 * Pons sweeps creator tax through its fee escrow rather than exposing a
 * caller-facing claim entry point we have verified, so LuxuryPad shows the real
 * accrued balance and links to the curve instead of offering a claim button
 * that might build the wrong transaction.
 */
export function CreatorEarnings({ address, entries }: { address: Address; entries: Entry[] }) {
  const { address: connected } = useAccount();
  const isOwner = connected?.toLowerCase() === address.toLowerCase();
  const withBalance = entries.filter((e) => BigInt(e.balance) > 0n);

  return (
    <section className="mt-12">
      <h2 className="display text-[24px]">Creator earnings</h2>
      <Card className="mt-5 p-6">
        {withBalance.length === 0 ? (
          <p className="text-[13px] text-muted">
            No creator tax has accrued on these launches yet.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {withBalance.map((e) => (
              <li key={e.curve} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="tabular truncate text-[14px]">{shortAddress(e.token)}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
                    {e.isNativeQuote ? "ETH" : shortAddress(e.quoteAsset)}
                  </p>
                </div>
                <p className="tabular shrink-0 text-[15px]">
                  {formatAmount(BigInt(e.balance), 18)} {e.isNativeQuote ? "ETH" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Rule className="my-5" />
        <p className="text-[11px] leading-relaxed text-muted">
          {isOwner
            ? "These balances are read live from each bonding curve. Pons routes creator tax through its fee escrow — LuxuryPad will add in-app claiming once that path is verified against the deployed contract."
            : "Balances are read live from each bonding curve."}
        </p>
      </Card>
    </section>
  );
}
