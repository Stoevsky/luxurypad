"use client";

import { useState } from "react";
import { explorerAddress } from "@/lib/chain/robinhood";

/** The LuxuryPad token contract. Displayed in full — a truncated CA is useless
 *  for the one thing people need it for, which is verifying they have the right
 *  address before they buy. */
export const LUXURYPAD_CA = "0x00f75c62464646432183c3edb80fc305f1037c3b";

export function CaBanner() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(LUXURYPAD_CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is permission-gated; the address is visible either way.
    }
  }

  return (
    <div className="border-b border-line bg-ink text-ground">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center">
        <span className="display text-[13px] tracking-[0.12em] text-gold">LUXURYPAD LIVE</span>
        <span className="hidden text-[13px] opacity-40 sm:inline">·</span>
        <span className="text-[12px] uppercase tracking-[0.14em] opacity-60">CA</span>
        <button
          onClick={copy}
          title="Copy contract address"
          className="tabular break-all text-[12px] underline decoration-dotted underline-offset-4 transition-opacity duration-200 hover:opacity-70"
        >
          {LUXURYPAD_CA}
        </button>
        <span className="tabular w-14 text-left text-[11px] text-gold">
          {copied ? "Copied" : ""}
        </span>
        <a
          href={explorerAddress(LUXURYPAD_CA)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] opacity-60 underline underline-offset-4 transition-opacity duration-200 hover:opacity-100"
        >
          Explorer
        </a>
      </div>
    </div>
  );
}
