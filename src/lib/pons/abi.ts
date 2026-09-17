import { parseAbi } from "viem";

/**
 * Pons V2 ABIs.
 *
 * PROVENANCE. The Blockscout verification for the factory is a stub
 * (`contracts/StubContract.sol`), so no publisher-supplied ABI exists. Every
 * fragment below was instead established from two independent sources that
 * agree exactly:
 *
 *   1. Canonical 4-byte signatures resolved from the openchain.xyz signature
 *      database for the selectors actually observed on-chain, and — for the
 *      curve — from selectors extracted out of the deployed bytecode itself.
 *   2. Byte-for-byte decoding of real mainnet transactions and logs. Every
 *      tuple offset, string field and trailing word in a live `launchToken` /
 *      `launchAndBuy` calldata decodes cleanly against these types.
 *
 * Reads were additionally executed against a live curve and returned sane
 * values (supply 1e27, 5/7 sellable, 4.2e18 graduation threshold).
 */

/** Socials struct carried inside the launch params tuple. */
export const ponsLaunchAbi = parseAbi([
  "struct Socials { string website; string x; string telegram; string discord; string extra; }",
  "struct LaunchParams { string name; string symbol; string imageUri; string description; Socials socials; address creator; uint16 creatorTaxBps; bool buybackEnabled; bytes32 salt; bytes32 originRef; }",
  // Factory. Observed selector 0xa72101af (17 of 51 sampled launches).
  "function launchToken(LaunchParams params, uint256 reserved, address quoteAsset, address[] extra) payable returns (address token, address curve)",
  // Router. Observed selector 0xf85f8e41 (27 of 51 sampled launches) — launch + first buy.
  "function launchAndBuy(LaunchParams params, uint256 reserved, address quoteAsset, uint256 buyAmount, uint256 minAmountOut, address recipient, address[] extra) payable returns (address token, address curve)",
]);

/**
 * Factory views. Confirmed live against 0x7ed5…ec7e on chain 4663:
 * `launchFee()` -> 5e14 wei, `launchEnabled()` -> true, and
 * `approvedPairTokens()` agreeing exactly with the launch simulation across
 * GLD/SLV/TSLA/RIVN/LULU (true) and ELF/CCL (false).
 */
export const ponsFactoryViewsAbi = parseAbi([
  "function launchFee() view returns (uint256)",
  "function launchEnabled() view returns (bool)",
  "function approvedPairTokens(address token) view returns (bool)",
]);

/**
 * Factory events.
 * TokenLaunched topic0 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
 * confirmed by log scan; topic order (token, curve, deployer) confirmed by
 * calling name()/symbol()/totalSupply() on each indexed address.
 */
export const ponsFactoryEventsAbi = parseAbi([
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address quoteAsset, uint256 reserved, uint256 graduationThreshold)",
  "event LaunchSwept(address indexed token)",
  "event PoolGraduated(address indexed token)",
  "event GraduationTokensPermanentlyLocked(address indexed token)",
]);

/** Per-token bonding curve. Selectors extracted from deployed curve bytecode. */
export const ponsCurveAbi = parseAbi([
  "function token() view returns (address)",
  "function deployer() view returns (address)",
  "function pairToken() view returns (address)",
  "function isNativeQuote() view returns (bool)",
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function quoteReserve() view returns (uint256)",
  "function tokenReserve() view returns (uint256)",
  "function realQuoteReserve() view returns (uint256)",
  "function phantomQuote() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function readyToGraduate() view returns (bool)",
  "function graduated() view returns (bool)",
  "function launchedAt() view returns (uint256)",
  "function launchSupply() view returns (uint256)",
  "function sellableTokens() view returns (uint256)",
  "function reservedTokens() view returns (uint256)",
  "function creatorTaxBps() view returns (uint16)",
  "function creatorTaxBalance() view returns (uint256)",
  "function feeBps() view returns (uint16)",
  "function feeEscrow() view returns (address)",
  "function snipeTaxStartBps() view returns (uint16)",
  "function snipeTaxSeconds() view returns (uint256)",
  "function currentSnipeTaxBps(address account) view returns (uint16)",
  "function buybackEnabled() view returns (bool)",
  "function maxInternalPriceImpactBps() view returns (uint256)",
  "function buy(uint256 amountIn, uint256 minAmountOut, address recipient) payable returns (uint256 amountOut)",
  "function sell(uint256 amountIn, uint256 minAmountOut, address recipient) returns (uint256 amountOut)",
  "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut)",
  "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut)",
  "event CurveCompleted()",
  // Custom errors — surfaced as human copy by lib/pons/errors.ts
  "error AlreadyGraduated()",
  "error InsufficientInputAmount()",
  "error InsufficientLiquidity()",
  "error InsufficientOutputAmount()",
  "error InvalidLaunchEconomics()",
  "error MinimumOutputRequired()",
  "error SlippageExceeded(uint256 expected, uint256 actual)",
  "error UnexpectedNativeValue()",
  "error ZeroAddress()",
  "error ZeroAmount()",
]);

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
