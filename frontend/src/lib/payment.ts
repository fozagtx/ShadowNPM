import { parseAbi } from "viem";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

/**
 * Sends a USDC transfer via MetaMask.
 * Returns the transaction hash.
 */
export async function sendUsdcPayment(
  walletClient: any,
  paymentInfo: {
    token: string;
    amount: string;
    payTo: string;
    chainId: number;
  },
): Promise<string> {
  const txHash = await walletClient.writeContract({
    address: paymentInfo.token as `0x${string}`,
    abi: erc20Abi,
    functionName: "transfer",
    args: [paymentInfo.payTo as `0x${string}`, BigInt(paymentInfo.amount)],
  });

  // Wait for confirmation
  await walletClient.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}
