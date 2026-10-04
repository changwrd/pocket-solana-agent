import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAgentKeypair } from "@/services/agentKey";
import { getSolBalance } from "@/services/wallet";
import { executeAgentAction } from "@/services/swap";
import { IS_MAINNET } from "@/services/wallet";
import { holdsEnoughSkr } from "@/services/skr";
import { MOCK_SOL_PRICE, TIERS } from "@/data/mockData";
import {
  loadLastRunAt,
  loadMainWalletAddress,
  loadRule,
  loadTransactions,
  saveLastRunAt,
  saveTransactions,
} from "@/services/persist";
import { Transaction } from "@/types";

export const AGENT_TASK_NAME = "pocket-agent-run";

TaskManager.defineTask(AGENT_TASK_NAME, async () => {
  try {
    await maybeRunAgent();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("Pocket background task failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * The actual decision logic: is it time to act, does the agent have funds,
 * and if so, do it. Shared by the real background task and by a manual
 * "force a background check" debug button, so you can test this without
 * waiting for Android's own schedule.
 */
export type AgentCheckResult = "ran" | "disabled" | "not_due" | "low_balance";

export async function maybeRunAgent(): Promise<AgentCheckResult> {
  const rule = await loadRule();
  if (!rule || !rule.enabled) {
    console.log("[agent] skipped: rule missing or disabled", rule);
    return "disabled";
  }

  // Real enforcement: check the wallet's actual on-chain SKR balance every
  // run, rather than trusting a locally stored flag. A stale or tampered
  // "staked" toggle in storage can't unlock anything this way — only a
  // real, freshly-checked balance can.
  const mainWalletAddress = await loadMainWalletAddress();
  const holdsSkr = mainWalletAddress
    ? await holdsEnoughSkr(new PublicKey(mainWalletAddress))
    : false;
  const tier = holdsSkr ? TIERS.staked : TIERS.free;

  // Without SKR, the agent is held to weekly regardless of what the rule
  // says — a locally-set "daily" rule can't bypass this, since the check
  // runs fresh, right here, every time.
  const effectiveFrequency = holdsSkr ? rule.frequency : "weekly";
  const intervalMs =
    effectiveFrequency === "daily"
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

  const lastRunAt = await loadLastRunAt();
  if (Date.now() - lastRunAt < intervalMs) {
    console.log(
      "[agent] skipped: not due yet, last run",
      Math.round((Date.now() - lastRunAt) / 1000),
      `s ago (tier: ${tier.name}, holdsSkr: ${holdsSkr})`,
    );
    return "not_due";
  }

  const agentKeypair = await getOrCreateAgentKeypair();
  const balance = await getSolBalance(agentKeypair.publicKey);
  console.log(
    "[agent] agent address:",
    agentKeypair.publicKey.toBase58(),
    "balance:",
    balance,
    "tier:",
    tier.name,
  );
  if (balance < 0.002) {
    console.log("[agent] skipped: balance too low (need >= 0.002 SOL)");
    return "low_balance";
  }

  // The rule's own amount is clamped to the real tier's cap — a locally-set
  // higher amount can't exceed what the on-chain check actually earned.
  // This is the number that will drive the real swap amount once this
  // points at mainnet; on devnet, only a small fixed amount actually moves.
  const cappedUsd = Math.min(rule.amountUsd, tier.capUsd);

  const returnTo = mainWalletAddress
    ? new PublicKey(mainWalletAddress)
    : agentKeypair.publicKey;

  console.log(
    `[agent] executing (${IS_MAINNET ? "MAINNET — real money" : "devnet"}), tier-capped amount: $${cappedUsd}`,
  );
  const result = await executeAgentAction(agentKeypair, returnTo);
  console.log(
    "[agent] confirmed:",
    result.description,
    "signature:",
    result.signature,
  );

  const tx: Transaction = {
    id: "tx" + Date.now(),
    label: `Automatic action (background, ${tier.name} tier, $${cappedUsd} cap)${IS_MAINNET ? " [MAINNET]" : ""}`,
    dateLabel: "Just now",
    amountUsd: cappedUsd,
    solAmount: result.solAmount,
    auto: true,
    txHash: result.signature.slice(0, 4) + "..." + result.signature.slice(-4),
  };

  const existing = (await loadTransactions()) ?? [];
  await saveTransactions([tx, ...existing]);
  await saveLastRunAt(Date.now());
  return "ran";
}

export async function registerAgentBackgroundTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(AGENT_TASK_NAME);
  if (isRegistered) return;
  await BackgroundTask.registerTaskAsync(AGENT_TASK_NAME, {
    minimumInterval: 15, // minutes — Android's practical floor via WorkManager.
    // The 15-minute value is how often Android *checks in*, not how often
    // the agent acts — maybeRunAgent() only actually does anything once
    // the rule's real frequency (daily/weekly) has elapsed.
  });
}

export async function unregisterAgentBackgroundTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(AGENT_TASK_NAME);
  if (isRegistered) await BackgroundTask.unregisterTaskAsync(AGENT_TASK_NAME);
}

/** Raw, unfiltered look at what's actually persisted — for debugging. */
export async function getDebugInfo() {
  const [rule, lastRunAt, transactions, isRegistered, mainWalletAddress] =
    await Promise.all([
      loadRule(),
      loadLastRunAt(),
      loadTransactions(),
      TaskManager.isTaskRegisteredAsync(AGENT_TASK_NAME),
      loadMainWalletAddress(),
    ]);

  const agentKeypair = await getOrCreateAgentKeypair();
  const balance = await getSolBalance(agentKeypair.publicKey);

  const holdsSkr = mainWalletAddress
    ? await holdsEnoughSkr(new PublicKey(mainWalletAddress))
    : false;
  const tier = holdsSkr ? TIERS.staked : TIERS.free;
  const effectiveFrequency = holdsSkr
    ? (rule?.frequency ?? "weekly")
    : "weekly";

  const intervalMs =
    effectiveFrequency === "daily"
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
  const msSinceLastRun = Date.now() - lastRunAt;
  const msUntilDue = intervalMs - msSinceLastRun;

  return {
    ruleEnabled: rule?.enabled ?? false,
    ruleFrequency: rule?.frequency ?? "none",
    effectiveFrequency,
    holdsSkr,
    tier: tier.name,
    effectiveCapUsd: tier.capUsd,
    lastRunAt,
    lastRunAgo:
      lastRunAt === 0 ? "never" : `${Math.round(msSinceLastRun / 1000)}s ago`,
    dueNow: msUntilDue <= 0,
    dueInSeconds: Math.max(0, Math.round(msUntilDue / 1000)),
    agentBalanceSol: balance,
    persistedTransactionCount: transactions?.length ?? 0,
    osTaskRegistered: isRegistered,
  };
}
