import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

/**
 * Given a 402 response and a viem WalletClient (with publicActions),
 * creates signed payment headers for retrying the request.
 */
export async function createPaymentHeaders(
  response: Response,
  signer: any,
): Promise<Record<string, string>> {
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const httpClient = new x402HTTPClient(client);

  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => response.headers.get(name),
  );

  const paymentPayload =
    await httpClient.createPaymentPayload(paymentRequired);

  return httpClient.encodePaymentSignatureHeader(paymentPayload);
}
