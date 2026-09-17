# LuxuryPad

**Luxury, launched onchain.**

A launch and discovery interface for **Pons V2** on **Robinhood Chain** (chain id `4663`),
built around luxury-market narratives.

---

## Read this first: the luxury premise does not hold as specified

The brief asks for a launchpad where users launch tokens paired with Ferrari, LVMH, Hermès,
Kering, Richemont, Moncler, Porsche and Burberry Stock Tokens.

**None of those Stock Tokens exist.** The live Robinhood Stock Token registry
(`https://api.robinhood.com/rhj/assets`) contains 194 active assets on Robinhood Chain, and it is
overwhelmingly US technology, semiconductors and ETFs. Verified absent: `RACE`, `MC`, `LVMUY`,
`RMS`, `KER`, `CFR`, `MONC`, `P911`, `BRBY`, `PRDSY`, `TPR`, `CPRI`, `EL`, `MAR`, `HLT`, `DEO`.

This is asserted by a test, not by a comment — see
`tests/registry.live.test.ts › contains none of the iconic luxury houses`. If Robinhood ever lists
one of them, that test fails and tells you to revisit the catalog.

Rather than invent contracts or stretch "luxury" until it meant nothing, the product implements the
three states the brief itself specifies, and derives them at runtime:

| State | Meaning | May say "Paired with" |
|---|---|---|
| **Pair available** | Stock Token exists **and** Pons accepts it as a launch pair | Yes |
| **Discovery only** | Stock Token exists, Pons does **not** accept it as a pair | No |
| **Theme** | No tokenised equity exists at all — editorial content only | No |

As resolved against live data:

- **Pair available (5):** Gold (`GLD`), Lululemon (`LULU`), Rivian (`RIVN`), Silver (`SLV`), Tesla (`TSLA`)
- **Discovery only (2):** Carnival (`CCL`), e.l.f. Beauty (`ELF`)
- **Theme (11):** Burberry, Estée Lauder, Ferrari, Hermès, Kering, LVMH, Moncler, Porsche, Prada,
  Richemont, Swatch Group

**The honest summary: this is a thin luxury catalog.** Five launchable pairs, of which two are
precious-metals ETFs and two are premium EV makers. If the product needs a real luxury story, the
constraint is upstream asset coverage, not this codebase.

---

## How the protocol integration was established

Pons V2 is real and actively used — 51 `TokenLaunched` events in a 5,000-block sample. But its
Blockscout verification is a **stub** (`contracts/StubContract.sol`), so no publisher ABI exists.
Every integration fact below was derived from two independent sources that agree exactly:

1. **Bytecode.** `eth_getCode` returns non-empty bytecode for every pinned address.
2. **Canonical signatures.** Selectors observed on chain — and, for the curve, selectors extracted
   directly out of the deployed bytecode — resolved against the openchain.xyz signature database.
3. **Byte-for-byte decoding.** Real mainnet `launchToken` / `launchAndBuy` calldata decodes cleanly
   against the resulting types, including every tuple offset and trailing word.

Contracts are pinned in `src/lib/pons/contracts.ts`, **not** in environment variables: they are
consensus-critical, and a wrong value silently sends funds to the wrong contract.

### Two protocol errors that shape the product

Simulating `launchToken` against the live factory returns one of three outcomes, and the
distinction is the backbone of the honesty guarantee:

| Result | Selector | Meaning |
|---|---|---|
| revert | `0x49285dfb` `PairTokenNotApproved()` | **Not** an approved pair |
| revert | `0xecb27319` `LaunchEconomicsMismatch(bytes32,bytes32)` | Approved; economics commitment stale |
| success | — | Approved, and the exact transaction will execute |

So `src/lib/pons/pairs.ts` does not consult a hardcoded allowlist. It **asks the protocol**, using
the same call path the real transaction takes. Scanning all 194 registry assets this way found
**63 genuinely pair-approved Stock Tokens**.

The `LaunchParams` field this codebase calls `salt` is in fact an **economics commitment hash**:
passing a non-zero value pins the launch to one exact economics configuration and reverts if the
protocol changed underneath you. Passing zero accepts current economics.

---

## What actually works

Everything below was exercised against mainnet, not mocked.

- **Registry resolution** — live Stock Token registry ∩ curated luxury taxonomy ∩ Pons pair
  allowlist, with explicit degraded states when either source is unreachable.
- **SIWE authentication** — EIP-4361 with one-time httpOnly nonce, domain binding, chain binding,
  expiry, server-side signature verification (EIP-1271 capable), and HS256 session cookies. A
  connected wallet is never treated as a session.
- **Launch preflight** — chain id, factory bytecode, pair approval, balance, ERC-20 allowance, and
  finally an `eth_call` of the **exact** transaction. The wallet prompt never appears unless that
  simulation succeeded; the simulation returns the predicted token and curve addresses.
- **Quotes** — buy quotes come from a real `eth_call` of `buy()` against the live curve with a
  balance state override, so the displayed number is the number the contract produces. A pinned
  constant-product formula is the fallback, and `tests/quote.live.test.ts` asserts it tracks the
  contract within 0.5% across order sizes, so a protocol change fails CI instead of mispricing.
- **Indexer** — reads real `TokenLaunched` logs, records the factory and protocol version on every
  row, and resolves a launch's curve from factory logs rather than trusting any client input.
- **Trading** — buy/sell against the curve with on-chain `minAmountOut`; graduated launches are
  refused rather than routed down the wrong execution path.
- **Share cards** — dynamic OG images stating the pairing and the disclosure, never performance.

## What is not built, and why

Reported plainly rather than stubbed:

- **No real launch, buy, sell or claim has been executed.** Those need a funded wallet and a user
  signature. Everything up to the signature is real and simulated against mainnet.
- **Creator fee claiming is read-only.** The curve exposes `creatorTaxBalance()` (shown live), but
  the sweep path is `sweepFees(uint256)` behind `feeSweepOperator()` — operator-gated, with no
  creator-facing claim entry point verified. A claim button would have meant shipping a transaction
  that might revert or do the wrong thing, so the real accrued balance is shown instead.
- **Graduated-token trading is not routed.** Graduation moves liquidity into a Uniswap V4 pool with
  a custom hook. The token page says so and declines to trade rather than use the curve path.
- **Supabase is not provisioned.** No project or credentials exist in this environment. The schema
  and RLS policies are written and reviewed in `supabase/migrations/0001_init.sql`; the app reads
  chain state directly in the meantime. Indexing is therefore an on-demand chain scan with a
  30-second cache, not a durable background worker.
- **Not built:** X OAuth, watchlist/favourites UI, notifications, username registration
  (profiles resolve by address at `/@0x…`), and near-graduation/graduated trading routes.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · viem · wagmi ·
TanStack Query · Zod · jose · Vitest.

## Getting started

```bash
npm install
cp .env.example .env.local   # set SESSION_SECRET (>= 32 chars)
npm run dev
```

```bash
npm run build   # production build
npm run lint    # eslint
npx vitest run  # 27 tests against live mainnet state
```

The test suite hits the public RPC, which rate-limits at 60 req/s; test files run serially for that
reason, and the RPC client retries 429s with backoff.

## Safety notes

- Development and tests point at **Robinhood Chain mainnet** because that is where Pons V2 is
  deployed. There is no testnet Pons deployment to point at. Nothing signs a transaction without an
  explicit user action, and every launch is simulated first.
- LuxuryPad never requests a seed phrase, recovery phrase or private key.
- The pair asset supplied by a client is validated against the live registry server-side before any
  preflight runs.

## Disclosure

LuxuryPad launches are independent user-created crypto tokens. They do not represent ownership,
voting rights, dividends, or claims on the referenced companies. Company names and trademarks
belong to their respective owners and imply no affiliation, endorsement or partnership.
