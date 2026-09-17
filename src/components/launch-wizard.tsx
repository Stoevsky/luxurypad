"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseEther, zeroAddress, type Address } from "viem";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { Button, Card, Eyebrow, Rule, StatePill } from "@/components/ui";
import { useSession } from "@/lib/auth/use-auth";
import type { LuxuryMarket } from "@/lib/registry/resolve";
import { SECTOR_LABELS, type LuxurySector } from "@/lib/registry/luxury";
import { explorerTx } from "@/lib/chain/robinhood";

type PreflightCheck = { id: string; label: string; status: "pass" | "fail" | "warn"; detail: string };
type Preflight = {
  ok: boolean;
  checks: PreflightCheck[];
  transaction?: { to: Address; data: `0x${string}`; value: string; predictedToken: Address; predictedCurve: Address; gas?: string };
  requiresApproval?: { token: Address; spender: Address; amount: string };
  error?: string;
};

const SECTOR_FILTERS: Array<{ id: "all" | LuxurySector; label: string }> = [
  { id: "all", label: "All" },
  { id: "fashion", label: "Fashion" },
  { id: "automotive", label: "Automotive" },
  { id: "watches", label: "Watches" },
  { id: "materials", label: "Materials" },
  { id: "beauty", label: "Beauty" },
  { id: "hospitality", label: "Hospitality" },
];

const STEPS = ["Market", "Create", "Economics", "Review"] as const;

export function LaunchWizard({
  markets,
  preselect,
  degraded,
}: {
  markets: LuxuryMarket[];
  preselect: string | null;
  degraded: boolean;
}) {
  const { data: session } = useSession();
  const { address, isConnected } = useAccount();

  const launchable = useMemo(() => markets.filter((m) => m.launchable), [markets]);
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState<"all" | LuxurySector>("all");
  const [selected, setSelected] = useState<LuxuryMarket | null>(
    () => launchable.find((m) => m.asset?.symbol.toUpperCase() === preselect?.toUpperCase()) ?? null,
  );

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [website, setWebsite] = useState("");
  const [x, setX] = useState("");
  const [creatorTaxBps, setCreatorTaxBps] = useState(100);
  const [initialBuy, setInitialBuy] = useState("");

  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendTransactionAsync, isPending: signing } = useSendTransaction();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const filtered = filter === "all" ? launchable : launchable.filter((m) => m.company.sector === filter);

  async function runPreflight() {
    setChecking(true);
    setError(null);
    setPreflight(null);
    try {
      const res = await fetch("/api/launch/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          description,
          imageUri,
          website: website || undefined,
          x: x || undefined,
          quoteAsset: selected?.asset?.address ?? zeroAddress,
          creatorTaxBps,
          initialBuy: initialBuy ? parseEther(initialBuy).toString() : "0",
          minAmountOut: "0",
        }),
      });
      const json = (await res.json()) as Preflight;
      if (!res.ok) {
        setError(json.error ?? "We couldn't prepare this launch.");
        return;
      }
      setPreflight(json);
    } catch {
      setError("We couldn't reach the launch service.");
    } finally {
      setChecking(false);
    }
  }

  async function sign() {
    if (!preflight?.transaction) return;
    setError(null);
    try {
      const hash = await sendTransactionAsync({
        to: preflight.transaction.to,
        data: preflight.transaction.data,
        value: BigInt(preflight.transaction.value),
      });
      setTxHash(hash);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /rejected|denied|User denied/i.test(msg)
          ? "The transaction was rejected."
          : "We couldn't submit this launch.",
      );
    }
  }

  // ——— Success ———
  if (txHash && receipt.isSuccess) {
    return (
      <Card className="mt-10 p-8">
        <Eyebrow>Launch live</Eyebrow>
        <h2 className="display mt-3 text-[32px]">{name}</h2>
        <p className="tabular mt-1 text-[13px] text-muted">${symbol.toUpperCase()}</p>
        <Rule className="my-6" />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="eyebrow">Luxury market</dt>
            <dd className="text-[14px]">{selected?.company.companyName ?? "ETH"}</dd>
          </div>
          <div>
            <dt className="eyebrow">Contract</dt>
            <dd className="tabular break-all text-[13px]">{preflight?.transaction?.predictedToken}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="eyebrow">Transaction</dt>
            <dd>
              <a
                href={explorerTx(txHash)}
                target="_blank"
                rel="noreferrer noopener"
                className="tabular break-all text-[13px] underline decoration-line underline-offset-4 hover:decoration-gold"
              >
                {txHash}
              </a>
            </dd>
          </div>
        </dl>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/token/${preflight?.transaction?.predictedToken}`}
            className="inline-flex h-11 items-center bg-ink px-6 text-sm font-medium text-ground"
          >
            View launch
          </Link>
          <Link
            href={`/token/${preflight?.transaction?.predictedToken}?share=1`}
            className="inline-flex h-11 items-center border border-line bg-card px-6 text-sm font-medium"
          >
            Share
          </Link>
        </div>
      </Card>
    );
  }

  // ——— Transaction in flight: real states only, no fake percentages ———
  if (txHash) {
    return (
      <Card className="mt-10 p-8">
        <Eyebrow>{receipt.isLoading ? "Confirming" : "Submitted"}</Eyebrow>
        <p className="display mt-3 text-[26px]">
          {receipt.isLoading ? "Waiting for confirmation…" : "Transaction submitted"}
        </p>
        <p className="mt-3 text-[13px] text-muted">
          We are watching the chain for this transaction. Nothing is confirmed until it is mined.
        </p>
        <a
          href={explorerTx(txHash)}
          target="_blank"
          rel="noreferrer noopener"
          className="tabular mt-5 block break-all text-[13px] underline decoration-line underline-offset-4"
        >
          {txHash}
        </a>
        {receipt.isError ? (
          <p className="mt-4 text-[13px] text-burgundy">
            We couldn&apos;t confirm this launch yet. Check the explorer link above.
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="mt-10">
      {/* Step rail */}
      <ol className="flex flex-wrap gap-x-6 gap-y-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`tabular text-[11px] ${i === step ? "text-gold" : "text-muted"}`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={`text-[13px] ${i === step ? "text-ink" : "text-muted"}`}>{s}</span>
          </li>
        ))}
      </ol>
      <Rule className="mt-3" />

      {degraded ? (
        <Card className="mt-6 p-4 text-[13px] text-burgundy">
          Live verification is degraded, so some markets may be missing. Nothing is shown as
          launchable unless it was verified.
        </Card>
      ) : null}

      {/* ——— Step 1: market ——— */}
      {step === 0 ? (
        <section className="mt-8">
          <div className="flex flex-wrap gap-2">
            {SECTOR_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`border px-3.5 py-1.5 text-[13px] transition-colors duration-200 ${
                  filter === f.id ? "border-ink bg-ink text-ground" : "border-line bg-card hover:border-gold"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card className="mt-6 p-8 text-center text-[13px] text-muted">
              No verified launch pairs in this category.
            </Card>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => {
                const active = selected?.company.id === m.company.id;
                return (
                  <button
                    key={m.company.id}
                    onClick={() => setSelected(m)}
                    className={`border p-5 text-left transition-all duration-200 ${
                      active ? "border-gold bg-card" : "border-line bg-card hover:border-gold"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="display text-[19px]">{m.company.companyName}</p>
                        <p className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
                          {m.asset?.symbol}
                        </p>
                      </div>
                      <StatePill state={m.state} />
                    </div>
                    <p className="mt-3 text-[12px] text-muted">{SECTOR_LABELS[m.company.sector]}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!selected} size="lg">
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ——— Step 2: create ——— */}
      {step === 1 ? (
        <section className="mt-8 max-w-2xl space-y-6">
          <Field label="Token name">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} className={inputClass} placeholder="Maranello Club" />
          </Field>
          <Field label="Ticker" hint="Letters and numbers only.">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={16}
              className={`${inputClass} tabular`}
              placeholder="MARANELLO"
            />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={4} className={`${inputClass} resize-none`} placeholder="What is this launch about?" />
          </Field>
          <Field label="Image URI" hint="An https:// or ipfs:// link to your token image.">
            <input value={imageUri} onChange={(e) => setImageUri(e.target.value)} maxLength={400} className={inputClass} placeholder="ipfs://…" />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Website (optional)">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="https://" />
            </Field>
            <Field label="X (optional)">
              <input value={x} onChange={(e) => setX(e.target.value)} className={inputClass} placeholder="https://x.com/…" />
            </Field>
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(2)} disabled={!name.trim() || !symbol.trim()} size="lg">
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* ——— Step 3: economics ——— */}
      {step === 2 ? (
        <section className="mt-8 max-w-2xl space-y-6">
          <Card className="p-6">
            <p className="eyebrow">Protocol economics</p>
            <Rule className="my-4" />
            <dl className="grid gap-4 sm:grid-cols-2 text-[14px]">
              <Row k="Pair asset" v={selected?.asset ? `${selected.company.companyName} (${selected.asset.symbol})` : "ETH"} />
              <Row k="Protocol" v="Pons V2" />
              <Row k="Network" v="Robinhood Chain" />
              <Row k="Supply" v="1,000,000,000 fixed" />
              <Row k="Sold on curve" v="5/7 of supply" />
              <Row k="Graduation" v="Set by the protocol per pair" />
            </dl>
            <p className="mt-4 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
              Fees, the graduation threshold and the launch fee are read from the live contract during
              review — they are never hardcoded here.
            </p>
          </Card>

          <Field label="Creator tax" hint="Charged on every curve trade and claimable by you.">
            <div className="flex flex-wrap gap-2">
              {[0, 50, 100, 200, 300].map((bps) => (
                <button
                  key={bps}
                  onClick={() => setCreatorTaxBps(bps)}
                  className={`tabular border px-4 py-2 text-[13px] transition-colors duration-200 ${
                    creatorTaxBps === bps ? "border-ink bg-ink text-ground" : "border-line bg-card hover:border-gold"
                  }`}
                >
                  {(bps / 100).toFixed(2)}%
                </button>
              ))}
            </div>
          </Field>

          <Field label="First buy (optional)" hint={`Amount of ${selected?.asset?.symbol ?? "ETH"} to buy at launch.`}>
            <input
              value={initialBuy}
              onChange={(e) => setInitialBuy(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className={`${inputClass} tabular`}
              placeholder="0.0"
            />
          </Field>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button
              size="lg"
              onClick={() => {
                setStep(3);
                void runPreflight();
              }}
            >
              Review
            </Button>
          </div>
        </section>
      ) : null}

      {/* ——— Step 4: review ——— */}
      {step === 3 ? (
        <section className="mt-8 max-w-2xl space-y-6">
          <Card className="p-6">
            <h2 className="display text-[28px]">{name}</h2>
            <p className="tabular mt-1 text-[13px] text-muted">${symbol}</p>
            <Rule className="my-5" />
            <dl className="grid gap-4 sm:grid-cols-2 text-[14px]">
              <Row
                k="Paired with"
                v={
                  selected?.asset
                    ? selected.assetSource === "luxury-pair"
                      ? selected.asset.symbol
                      : `${selected.company.companyName} Stock Token`
                    : "ETH"
                }
              />
              <Row k="Creator" v={address ? `${address.slice(0, 10)}…` : "—"} />
              <Row k="Creator tax" v={`${(creatorTaxBps / 100).toFixed(2)}%`} />
              <Row k="First buy" v={initialBuy ? `${initialBuy} ${selected?.asset?.symbol ?? "ETH"}` : "None"} />
              <Row k="Protocol" v="Pons V2" />
              <Row k="Network" v="Robinhood Chain" />
            </dl>
          </Card>

          {!session ? (
            <Card className="p-5 text-[13px] text-burgundy">
              Sign in with your wallet before launching.
            </Card>
          ) : null}

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Live protocol checks</p>
              <button onClick={() => void runPreflight()} disabled={checking} className="text-[12px] text-muted hover:text-ink">
                {checking ? "Checking…" : "Re-check"}
              </button>
            </div>
            <Rule className="my-4" />
            {checking && !preflight ? (
              <p className="text-[13px] text-muted">Verifying against the live contract…</p>
            ) : preflight ? (
              <ul className="space-y-3">
                {preflight.checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        c.status === "pass" ? "bg-gold" : c.status === "warn" ? "bg-champagne" : "bg-burgundy"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px]">{c.label}</span>
                      <span className="block text-[12px] text-muted">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Not checked yet.</p>
            )}
          </Card>

          {error ? <Card className="p-5 text-[13px] text-burgundy">{error}</Card> : null}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button
              size="lg"
              onClick={() => void sign()}
              disabled={!preflight?.ok || !preflight.transaction || signing || !session || !isConnected}
            >
              {signing ? "Check your wallet…" : "Launch"}
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            LuxuryPad launches are independent user-created crypto tokens. They do not represent
            ownership, voting rights, dividends, or claims on the referenced companies.
          </p>
        </section>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full border border-line bg-card px-4 py-3.5 text-[15px] outline-none transition-colors duration-200 placeholder:text-muted focus:border-gold";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="eyebrow">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="eyebrow">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
