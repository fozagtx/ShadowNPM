import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

/**
 * Given a 402 response and a viem WalletClient (with publicActions),
 * creates signed payment headers for retrying the request.
 */
export async function createPaymentHeaders(
  response: Response,
  walletClient: any,
): Promise<Record<string, string>> {
  // Check if the 402 actually has payment info
  const hasPaymentHeader = response.headers.get("PAYMENT-REQUIRED") || response.headers.get("payment-required");
  let body: any;
  try {
    body = await response.clone().json();
  } catch { /* empty */ }

  if (!hasPaymentHeader && !body?.x402Version) {
    throw new Error("Server returned 402 but payment is not configured. Try again later.");
  }

  // Build x402-compatible signer — x402 expects .address at top level
  // but viem puts it at .account.address
  const address = walletClient.account?.address ?? walletClient.address;
  if (!address) {
    throw new Error("Wallet has no address — reconnect your wallet and try again.");
  }
  const signer = Object.create(walletClient);
  signer.address = address;

  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const httpClient = new x402HTTPClient(client);

  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => response.headers.get(name),
    body,
  );

  const paymentPayload =
    await httpClient.createPaymentPayload(paymentRequired);

  return httpClient.encodePaymentSignatureHeader(paymentPayload);
}
