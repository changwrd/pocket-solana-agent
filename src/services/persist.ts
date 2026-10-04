import * as SecureStore from "expo-secure-store";
import { Rule, Transaction } from "@/types";

const KEYS = {
  rule: "pocket_rule",
  staked: "pocket_staked",
  mainWallet: "pocket_main_wallet_address",
  transactions: "pocket_transactions",
  lastRunAt: "pocket_last_run_at",
};

export async function saveRule(rule: Rule) {
  await SecureStore.setItemAsync(KEYS.rule, JSON.stringify(rule));
}
export async function loadRule(): Promise<Rule | null> {
  const raw = await SecureStore.getItemAsync(KEYS.rule);
  return raw ? JSON.parse(raw) : null;
}

export async function saveStaked(staked: boolean) {
  await SecureStore.setItemAsync(KEYS.staked, JSON.stringify(staked));
}
export async function loadStaked(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEYS.staked);
  return raw ? JSON.parse(raw) : false;
}

export async function saveMainWalletAddress(address: string | null) {
  if (address) await SecureStore.setItemAsync(KEYS.mainWallet, address);
  else await SecureStore.deleteItemAsync(KEYS.mainWallet);
}
export async function loadMainWalletAddress(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.mainWallet);
}

export async function saveTransactions(transactions: Transaction[]) {
  // Keep this bounded — this is device storage, not a database.
  await SecureStore.setItemAsync(
    KEYS.transactions,
    JSON.stringify(transactions.slice(0, 50)),
  );
}
export async function loadTransactions(): Promise<Transaction[] | null> {
  const raw = await SecureStore.getItemAsync(KEYS.transactions);
  return raw ? JSON.parse(raw) : null;
}

export async function saveLastRunAt(timestamp: number) {
  await SecureStore.setItemAsync(KEYS.lastRunAt, String(timestamp));
}
export async function loadLastRunAt(): Promise<number> {
  const raw = await SecureStore.getItemAsync(KEYS.lastRunAt);
  return raw ? Number(raw) : 0;
}
export async function clearLastRunAt() {
  await SecureStore.deleteItemAsync(KEYS.lastRunAt);
}
