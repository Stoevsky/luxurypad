import { createConfig, http, injected } from "wagmi";
import { coinbaseWallet, walletConnect } from "wagmi/connectors";
import { robinhoodChain } from "./robinhood";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * Wallet support. `injected` covers MetaMask, Phantom's EVM provider, Trust and
 * Rabby; Coinbase Wallet and WalletConnect are added explicitly so mobile deep
 * links work. WalletConnect is only registered when a project id is configured —
 * registering it without one throws at runtime.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "LuxuryPad", preference: "all" }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
            metadata: {
              name: "LuxuryPad",
              description: "Luxury, launched onchain.",
              url: process.env.NEXT_PUBLIC_APP_URL ?? "https://luxurypad.app",
              icons: [],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [robinhoodChain.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
    ),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
