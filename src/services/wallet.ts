import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

// THE ONE SWITCH THAT MATTERS: everything the agent does — funding,
// running, returning funds — follows this. Flip it to "mainnet-beta" only
// when you deliberately want to test with real SOL. Leave it on "devnet"
// for everyday development.
type ClusterName = "devnet" | "mainnet-beta";
export const NETWORK: ClusterName = "mainnet-beta";

// Written as a function, not a direct === comparison, on purpose: with a
// const literal, TypeScript narrows NETWORK's type to exactly "devnet" (its
// initial value) even with the wider annotation above, and then flags any
// comparison to "mainnet-beta" as a type error (TS2367) — a real compiler
// quirk, not a mistake in the check itself.
function checkIsMainnet(network: ClusterName): boolean {
  return network === "mainnet-beta";
}
export const IS_MAINNET = checkIsMainnet(NETWORK);

export const connection = new Connection(clusterApiUrl(NETWORK), "confirmed");

const APP_IDENTITY = {
  name: "Pocket",
  uri: "https://pocket-agent.app",
  icon: "favicon.ico",
};

export interface AuthResult {
  publicKey: PublicKey;
  authToken: string;
}

/**
 * First-time connect. Opens the user's installed wallet app (Phantom,
 * Solflare, etc. — or the Seeker's built-in wallet) via Mobile Wallet
 * Adapter, and asks them to approve. Returns an auth token you should
 * store and reuse via reauthorize() so the user isn't re-prompted every
 * time the agent needs to sign something.
 */
export async function authorizeWallet(): Promise<AuthResult> {
  return await transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      cluster: NETWORK,
      identity: APP_IDENTITY,
    });

    const account = authResult.accounts[0];
    const publicKey = new PublicKey(Buffer.from(account.address, "base64"));

    return { publicKey, authToken: authResult.auth_token };
  });
}

/**
 * Reuses a previous authorization instead of prompting the user again.
 * Call this on app start if you have a stored authToken.
 */
export async function reauthorizeWallet(
  authToken: string,
): Promise<AuthResult> {
  return await transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.reauthorize({
      auth_token: authToken,
      identity: APP_IDENTITY,
    });

    const account = authResult.accounts[0];
    const publicKey = new PublicKey(Buffer.from(account.address, "base64"));

    return { publicKey, authToken: authResult.auth_token };
  });
}

export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Devnet has been slow/congested — the standard blockhash-expiry check can
 * throw "signature has expired" even when the transaction is still fine,
 * or about to land. Poll the actual signature status instead of trusting
 * the tight default expiry window.
 */
export async function confirmSignature(
  signature: string,
  maxWaitMs = 30000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { value } = await connection.getSignatureStatus(signature);
    if (value?.err) {
      throw new Error(
        `Transaction failed on-chain (${JSON.stringify(value.err)}).`,
      );
    }
    if (
      value?.confirmationStatus === "confirmed" ||
      value?.confirmationStatus === "finalized"
    ) {
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(
    "Couldn't confirm in time — devnet may be congested. Check 'Refresh agent balance' in a minute; it may have gone through anyway.",
  );
}

/** Devnet only — free test SOL so you're not begging a faucet mid-demo. */
export async function requestDevnetAirdrop(publicKey: PublicKey, sol = 1) {
  if (IS_MAINNET) {
    throw new Error(
      "Airdrops don't exist on mainnet — that's real money. Fund this wallet yourself, deliberately.",
    );
  }
  const signature = await connection.requestAirdrop(
    publicKey,
    sol * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/**
 * The one moment the human is asked to approve anything: transferring a
 * capped amount of SOL from the main wallet (via MWA) into the agent's own
 * account. This requires a real tap-to-approve in Jupiter/Phantom, exactly
 * like any normal transaction — Pocket cannot skip this step, by design.
 *
 * After this, the agent key can spend what it was given without asking
 * again, because it's genuinely its own funds now.
 */
export async function fundAgentWallet(
  authToken: string,
  mainPublicKey: PublicKey,
  agentPublicKey: PublicKey,
  solAmount: number,
): Promise<string> {
  return await transact(async (wallet: Web3MobileWallet) => {
    await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: mainPublicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(
      SystemProgram.transfer({
        fromPubkey: mainPublicKey,
        toPubkey: agentPublicKey,
        lamports: Math.round(solAmount * LAMPORTS_PER_SOL),
      }),
    );

    const signatures = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });

    const signature = signatures[0];

    // Poll for the real outcome rather than trusting the tight blockhash
    // expiry window — devnet has been slow enough today to hit that even
    // on transactions that end up landing fine.
    await confirmSignature(signature);

    return signature;
  });
}
