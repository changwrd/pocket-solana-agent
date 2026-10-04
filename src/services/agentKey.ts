import * as SecureStore from "expo-secure-store";
import { Keypair } from "@solana/web3.js";

const STORAGE_KEY = "pocket_agent_secret_key";

/**
 * The agent's own keypair. This is intentionally NOT your main wallet key —
 * it's a separate, generated-on-device key that only ever holds whatever
 * amount you explicitly fund it with. Even in the worst case (bug, bad
 * actor, whatever), the maximum exposure is capped at that funded amount,
 * because that's literally all this account can ever contain.
 *
 * Stored via expo-secure-store, which uses Android's Keystore / iOS
 * Keychain under the hood — not plain storage.
 */
export async function getOrCreateAgentKeypair(): Promise<Keypair> {
  const existing = await SecureStore.getItemAsync(STORAGE_KEY);
  if (existing) {
    const secretKey = Uint8Array.from(JSON.parse(existing));
    return Keypair.fromSecretKey(secretKey);
  }

  const keypair = Keypair.generate();
  await SecureStore.setItemAsync(
    STORAGE_KEY,
    JSON.stringify(Array.from(keypair.secretKey)),
  );
  return keypair;
}

export async function hasAgentKeypair(): Promise<boolean> {
  const existing = await SecureStore.getItemAsync(STORAGE_KEY);
  return existing !== null;
}

/** Called on "Revoke agent access" — deletes the key entirely. */
export async function deleteAgentKeypair(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
