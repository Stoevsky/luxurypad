"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseUnits, type Address } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button, Card, Rule } from "@/components/ui";
import { ponsCurveAbi } from "@/lib/pons/abi";
import { explorerTx } from "@/lib/chain/robinhood";
import { formatAmount } from "@/lib/format";

type Side = "buy" | "sell";

type QuoteResponse = {
  quote: {
    amountIn: string;
    amountOut: string;
    protocolFee: string;
    creatorTax: string;
    priceImpactBps: number;
    minAmountOut: string;
    simulated: boolean;
  };
  phase: string;
  error?: string;
};

const SLIPPAGE = [50, 100, 200] as const;

export function TradePanel({
  token,
  tokenSymbol,
  tokenDecimals,
  curve,
  quoteSymbol,
  isNativeQuote,
  phase,
  creatorTaxBps,
  feeBps,
}: {
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  curve: Address;
  quoteSymbol: string;
  isNativeQuote: boolean;
  phase: "curve" | "ready_to_graduate" | "graduated";
  creatorTaxBps: number;
  feeBps: number;
  state: { snipeTaxStartBps: number; snipeTaxSeconds: number };
}) {
  const { address, isConnected } = useAccount();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [customSlippage, setCustomSlippage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const decimals = side === "buy" ? 18 : tokenDecimals;
  let amountIn = 0n;
  try {
    amountIn = amount ? parseUnits(amount, decimals) : 0n;
  } catch {
    amountIn = 0n;
  }

  const { data, isFetching } = useQuery({
    queryKey: ["quote", token, side, amountIn.toString(), slippageBps, address],
    enabled: amountIn > 0n && phase !== "graduated",
    queryFn: async (): Promise<QuoteResponse | null> => {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          side,
          amount: amountIn.toString(),
          slippageBps,
          account: address,
        }),
      });
      const json = (await res.json()) as QuoteResponse;
      if (!res.ok) throw new Error(json.error ?? "Quote unavailable.");
      return json;
    },
    refetchInterval: 15_000,
    retry: 0,
  });

  const quote = data?.quote;

  if (phase === "graduated") {
    return (
      <Card className="p-6">
        <p className="eyebrow">Trade</p>
        <Rule className="my-4" />
        <p className="text-[13px] leading-relaxed text-muted">
          This launch has graduated. Curve trading is closed — it now trades through its Uniswap V4
          pool. LuxuryPad does not route graduated trades yet, so use the pool directly rather than
          risk the wrong execution path.
        </p>
      </Card>
    );
  }

  async function submit() {
    setError(null);
    if (!quote || amountIn <= 0n) return;
    try {
      // Split rather than a ternary: `buy` is payable and `sell` is not, so the
      // two calls have genuinely different shapes.
      const hash =
        side === "buy"
          ? await writeContractAsync({
              address: curve,
              abi: ponsCurveAbi,
              functionName: "buy",
              args: [amountIn, BigInt(quote.minAmountOut), address as Address],
              value: isNativeQuote ? amountIn : 0n,
            })
          : await writeContractAsync({
              address: curve,
              abi: ponsCurveAbi,
              functionName: "sell",
              args: [amountIn, BigInt(quote.minAmountOut), address as Address],
            });
      setTxHash(hash);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /rejected|denied/i.test(msg) ? "The transaction was rejected." : "We couldn't submit this trade.",
      );
    }
  }

  const inSymbol = side === "buy" ? quoteSymbol : tokenSymbol;
  const outSymbol = side === "buy" ? tokenSymbol : quoteSymbol;

  return (
    <Card className="p-6 lg:sticky lg:top-24">
      <div className="grid grid-cols-2 gap-px border border-line bg-line">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
            className={`py-2.5 text-[13px] capitalize transition-colors duration-200 ${
              side === s ? "bg-ink text-ground" : "bg-card text-muted hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="mt-5 block space-y-2">
        <span className="eyebrow">You pay</span>
        <div className="flex items-center border border-line bg-card focus-within:border-gold">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0.0"
            className="tabular w-full bg-transparent px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
          <span className="tabular shrink-0 px-4 text-[13px] text-muted">{inSymbol}</span>
        </div>
      </label>

      <div className="mt-5 space-y-2">
        <span className="eyebrow">Slippage</span>
        <div className="flex flex-wrap gap-2">
          {SLIPPAGE.map((bps) => (
            <button
              key={bps}
              onClick={() => {
                setSlippageBps(bps);
                setCustomSlippage("");
              }}
              className={`tabular border px-3 py-1.5 text-[12px] transition-colors duration-200 ${
                slippageBps === bps && !customSlippage
                  ? "border-ink bg-ink text-ground"
                  : "border-line bg-card hover:border-gold"
              }`}
            >
              {(bps / 100).toFixed(1)}%
            </button>
          ))}
          <input
            value={customSlippage}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              setCustomSlippage(v);
              const pct = Number(v);
              if (Number.isFinite(pct) && pct >= 0 && pct <= 50) setSlippageBps(Math.round(pct * 100));
            }}
            placeholder="Custom"
            inputMode="decimal"
            className="tabular w-20 border border-line bg-card px-2 py-1.5 text-[12px] outline-none focus:border-gold"
          />
        </div>
      </div>

      <Rule className="my-5" />

      <dl className="space-y-2.5 text-[13px]">
        <QuoteRow k="You receive" v={quote ? `${formatAmount(BigInt(quote.amountOut), side === "buy" ? tokenDecimals : 18)} ${outSymbol}` : "—"} strong />
        <QuoteRow k="Minimum received" v={quote ? `${formatAmount(BigInt(quote.minAmountOut), side === "buy" ? tokenDecimals : 18)} ${outSymbol}` : "—"} />
        <QuoteRow k="Price impact" v={quote ? `${(quote.priceImpactBps / 100).toFixed(2)}%` : "—"} />
        <QuoteRow k="Protocol fee" v={`${(feeBps / 100).toFixed(2)}%`} />
        <QuoteRow k="Creator tax" v={`${(creatorTaxBps / 100).toFixed(2)}%`} />
      </dl>

      {quote && !quote.simulated ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Estimated from live curve reserves. Your minimum received is still enforced onchain.
        </p>
      ) : null}
      {isFetching && !quote ? <p className="mt-3 text-[12px] text-muted">Fetching a live quote…</p> : null}

      <div className="mt-5">
        <Button
          onClick={() => void submit()}
          disabled={!isConnected || !quote || amountIn <= 0n || isPending}
          size="lg"
          className="w-full"
        >
          {!isConnected ? "Connect a wallet" : isPending ? "Check your wallet…" : side === "buy" ? "Buy" : "Sell"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-[12px] text-burgundy">{error}</p> : null}

      {txHash ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[12px] text-muted">
            {receipt.isLoading ? "Confirming…" : receipt.isSuccess ? "Confirmed." : "Submitted."}
          </p>
          <a
            href={explorerTx(txHash)}
            target="_blank"
            rel="noreferrer noopener"
            className="tabular mt-1 block break-all text-[12px] underline decoration-line underline-offset-4"
          >
            {txHash}
          </a>
        </div>
      ) : null}
    </Card>
  );
}

function QuoteRow({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className={`tabular text-right ${strong ? "text-[15px]" : ""}`}>{v}</dd>
    </div>
  );
}
