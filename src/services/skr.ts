import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

// IMPORTANT: verify this against https://solanamobile.com/skr (or the
// official SKR announcement) before relying on it for anything real. Mint
// addresses circulating in secondary sources aren't a substitute for the
// canonical one — get this wrong and the balance check silently reads 0
// for everyone, which fails safe (falls back to the Free tier) but isn't
// what you want for a demo.
export const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";

// This is a HOLDING check, not a staking check. There's no confirmed public
// interface for reading a real staked-SKR balance from a third-party app,
// so this reads the wallet's plain SKR token balance instead. Say "holds
// SKR" in the UI, not "staked SKR" — those are different claims and judges
// may know the difference.
export const SKR_HOLD_THRESHOLD = 1; // in whole SKR tokens — tune once you know real distribution sizes

// SKR lives on mainnet, not devnet — this is a separate, read-only
// connection used only for this check. It never signs or sends anything.
const mainnetConnection = new Connection(
  clusterApiUrl("mainnet-beta"),
  "confirmed",
);

/**
 * Returns the wallet's real SKR token balance (0 if it holds none, if the
 * mint address above is wrong, or if the RPC call fails — every failure
 * mode here should fail toward the Free tier, never toward a false
 * "unlocked" state).
 */
export async function getSkrBalance(owner: PublicKey): Promise<number> {
  try {
    const mint = new PublicKey(SKR_MINT);
    const accounts = await mainnetConnection.getParsedTokenAccountsByOwner(
      owner,
      { mint },
    );
    let total = 0;
    for (const { account } of accounts.value) {
      const amount = account.data.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amount === "number") total += amount;
    }
    return total;
  } catch (err) {
    console.warn(
      "[skr] balance check failed, defaulting to 0 (Free tier):",
      err,
    );
    return 0;
  }
}

export async function holdsEnoughSkr(owner: PublicKey): Promise<boolean> {
  const balance = await getSkrBalance(owner);
  return balance >= SKR_HOLD_THRESHOLD;
}
