import {
  Keypair,
  VersionedTransaction,
  SystemProgram,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import { connection, confirmSignature, IS_MAINNET } from "@/services/wallet";

const JUPITER_API_KEY = process.env.EXPO_PUBLIC_JUPITER_API_KEY ?? "";
const JUPITER_BASE = "https://api.jup.ag/swap/v2";

export const MINTS = {
  SOL: "So11111111111111111111111111111111111111112", // wrapped SOL mint
  USDC_MAINNET: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

interface JupiterOrderResponse {
  requestId: string;
  transaction: string; // base64-encoded, unsigned
  inAmount: string;
  outAmount: string;
}

async function getJupiterOrder(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  taker: string,
): Promise<JupiterOrderResponse> {
  if (!JUPITER_API_KEY) {
    throw new Error(
      "Missing EXPO_PUBLIC_JUPITER_API_KEY — set it in your .env file (see .env.example).",
    );
  }

  const url = `${JUPITER_BASE}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&taker=${taker}`;
  const res = await fetch(url, { headers: { "x-api-key": JUPITER_API_KEY } });
  if (!res.ok) {
    throw new Error(
      `Jupiter order request failed (${res.status}). No route found is common on low-liquidity pairs.`,
    );
  }
  return res.json();
}

async function executeJupiterOrder(
  signedTransactionBase64: string,
  requestId: string,
) {
  const res = await fetch(`${JUPITER_BASE}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": JUPITER_API_KEY,
    },
    body: JSON.stringify({
      signedTransaction: signedTransactionBase64,
      requestId,
    }),
  });
  const body = await res.json();
  if (!res.ok || body.status === "Failed") {
    throw new Error(body.error ?? `Swap execution failed (${res.status}).`);
  }
  return body; // includes signature, status
}

/**
 * MAINNET ONLY. Buys `outputMint` using `amountLamports` of `inputMint`,
 * signed entirely by the agent's own keypair — no human approval, no MWA
 * popup. This is the actual autonomous action Pocket is built around.
 *
 * Don't call this against devnet — Jupiter has no route to give you there.
 */
export async function performAgentSwap(
  agentKeypair: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
): Promise<string> {
  const order = await getJupiterOrder(
    inputMint,
    outputMint,
    amountLamports,
    agentKeypair.publicKey.toBase58(),
  );

  const tx = VersionedTransaction.deserialize(
    Buffer.from(order.transaction, "base64"),
  );
  tx.sign([agentKeypair]);
  const signedBase64 = Buffer.from(tx.serialize()).toString("base64");

  const result = await executeJupiterOrder(signedBase64, order.requestId);
  return result.signature as string;
}

/**
 * DEVNET STAND-IN. There's no real swap to test against on devnet, so this
 * proves the part that actually matters right now: the agent signs and
 * sends a real, on-chain transaction entirely on its own, with no human
 * approval in the loop. It's a real transfer (tiny amount, back to the
 * agent's own account is pointless, so we send a small amount to the main
 * wallet instead — like a "dividend" — just to produce a real, verifiable
 * signature). Swap this out for performAgentSwap() once testing on mainnet.
 */
export async function performDevnetDemoAction(
  agentKeypair: Keypair,
  returnToPublicKey: PublicKey,
  lamports: number,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const transaction = new Transaction({
    feePayer: agentKeypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({
      fromPubkey: agentKeypair.publicKey,
      toPubkey: returnToPublicKey,
      lamports,
    }),
  );

  transaction.sign(agentKeypair);
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
  );

  await confirmSignature(signature);
  return signature;
}

/**
 * Sends the agent's ENTIRE balance back to `toPublicKey`, signed by the
 * agent's own key. A system account can't be left holding less than the
 * rent-exempt minimum (~0.00089 SOL), so we drain it to exactly zero:
 * amount = balance - fee, and the fee then takes the remaining 5000 lamports.
 */
export async function sweepAgentFunds(
  agentKeypair: Keypair,
  toPublicKey: PublicKey,
): Promise<{ signature: string; sol: number }> {
  const FEE_LAMPORTS = 5000;
  const balance = await connection.getBalance(agentKeypair.publicKey);
  if (balance <= FEE_LAMPORTS) {
    throw new Error("Nothing to return — the agent's balance is empty.");
  }
  const lamports = balance - FEE_LAMPORTS;

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const transaction = new Transaction({
    feePayer: agentKeypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({
      fromPubkey: agentKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports,
    }),
  );

  transaction.sign(agentKeypair);
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
  );
  await confirmSignature(signature);
  return { signature, sol: lamports / 1_000_000_000 };
}

// Deliberately tiny — the first real-money test should risk as little as
// possible. Widen this only once you've watched it work correctly at least
// once. At typical SOL prices this is well under $1.
const MAINNET_TEST_LAMPORTS = 3_000_000; // 0.003 SOL

export interface AgentActionResult {
  signature: string;
  solAmount: number;
  description: string;
}

/**
 * The single place that decides what the agent's autonomous action
 * actually does, based on the NETWORK switch in wallet.ts. Both the
 * background task and the manual "Run now" button call this — neither one
 * should decide mainnet-vs-devnet behavior on its own, so there's exactly
 * one place this logic can drift or be gotten wrong.
 */
export async function executeAgentAction(
  agentKeypair: Keypair,
  returnToPublicKey: PublicKey,
): Promise<AgentActionResult> {
  if (IS_MAINNET) {
    // Real trade: a small, fixed amount of the agent's own SOL, swapped
    // into USDC through live Jupiter liquidity. No human approval, no MWA
    // popup — the agent's own key signs this entirely on its own.
    const signature = await performAgentSwap(
      agentKeypair,
      MINTS.SOL,
      MINTS.USDC_MAINNET,
      MAINNET_TEST_LAMPORTS,
    );
    return {
      signature,
      solAmount: MAINNET_TEST_LAMPORTS / 1_000_000_000,
      description: "Swapped SOL → USDC on mainnet via Jupiter",
    };
  }

  // Devnet: no real liquidity to trade against, so this proves the part
  // that actually matters right now — an autonomous, agent-signed,
  // on-chain transaction — without pretending it's a real trade.
  const lamports = 1_000_000; // 0.001 SOL
  const signature = await performDevnetDemoAction(
    agentKeypair,
    returnToPublicKey,
    lamports,
  );
  return {
    signature,
    solAmount: lamports / 1_000_000_000,
    description:
      "Devnet placeholder transfer (no real swap liquidity exists here)",
  };
}
