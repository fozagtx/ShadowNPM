import { create } from "zustand";
import { createWalletClient, custom, publicActions } from "viem";
import { arcTestnet } from "../lib/arcTestnet";

function createExtendedClient(
  account: `0x${string}`,
  ethereum: any
) {
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: custom(ethereum),
  }).extend(publicActions);
}

type ExtendedWalletClient = ReturnType<typeof createExtendedClient>;

let walletClient: ExtendedWalletClient | null = null;

interface WalletState {
  address: `0x${string}` | null;
  isConnecting: boolean;
  error: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  getSigner: () => ExtendedWalletClient | null;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  isConnecting: false,
  error: null,

  connect: async () => {
    if (get().address) return;

    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      set({ error: "Install MetaMask to pay for audits" });
      return;
    }

    set({ isConnecting: true, error: null });

    try {
      // Request accounts
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts.length) {
        set({ isConnecting: false, error: "No accounts found" });
        return;
      }

      // Try switching to Arc testnet
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${arcTestnet.id.toString(16)}` }],
        });
      } catch (switchErr: any) {
        // 4902 = chain not added yet
        if (switchErr.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${arcTestnet.id.toString(16)}`,
                chainName: arcTestnet.name,
                nativeCurrency: arcTestnet.nativeCurrency,
                rpcUrls: [arcTestnet.rpcUrls.default.http[0]],
                blockExplorerUrls: arcTestnet.blockExplorers
                  ? [arcTestnet.blockExplorers.default.url]
                  : undefined,
              },
            ],
          });
        } else {
          throw switchErr;
        }
      }

      const address = accounts[0] as `0x${string}`;

      walletClient = createExtendedClient(address, ethereum);

      set({ address, isConnecting: false });

      // Listen for account/chain changes
      const onAccountsChanged = (accs: unknown) => {
        const newAccs = accs as string[];
        if (!newAccs.length) {
          get().disconnect();
        } else {
          const newAddr = newAccs[0] as `0x${string}`;
          walletClient = createExtendedClient(newAddr, ethereum);
          set({ address: newAddr });
        }
      };

      ethereum.on("accountsChanged", onAccountsChanged);
    } catch (err: any) {
      set({
        isConnecting: false,
        error: err?.message || "Wallet connection failed",
      });
    }
  },

  disconnect: () => {
    walletClient = null;
    set({ address: null, error: null });
  },

  getSigner: () => walletClient,
}));
