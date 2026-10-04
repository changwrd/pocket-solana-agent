import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { PublicKey } from "@solana/web3.js";
import { MOCK_SOL_PRICE, TIERS } from "@/data/mockData";
import { Rule, Transaction } from "@/types";
import {
  authorizeWallet,
  fundAgentWallet,
  getSolBalance,
  requestDevnetAirdrop,
} from "@/services/wallet";
import {
  deleteAgentKeypair,
  getOrCreateAgentKeypair,
} from "@/services/agentKey";
import { getSkrBalance, SKR_HOLD_THRESHOLD } from "@/services/skr";
import { executeAgentAction, sweepAgentFunds } from "@/services/swap";
import { Keypair } from "@solana/web3.js";
import {
  loadRule,
  loadTransactions,
  saveMainWalletAddress,
  saveRule,
  saveTransactions,
} from "@/services/persist";
import {
  AgentCheckResult,
  maybeRunAgent,
  registerAgentBackgroundTask,
  unregisterAgentBackgroundTask,
} from "@/services/backgroundTask";

interface AgentContextValue {
  hasOnboarded: boolean;
  completeOnboarding: () => void;

  walletConnected: boolean;
  walletAddress: string;
  connecting: boolean;
  connectError: string | null;
  connectWallet: () => Promise<boolean>;
  refreshBalance: () => Promise<void>;
  requestingAirdrop: boolean;
  airdropError: string | null;
  getDevnetSol: () => Promise<void>;

  balanceSol: number;
  solPrice: number;

  rule: Rule;
  setRule: (rule: Rule) => void;
  pauseAgent: () => void;
  resumeAgent: () => void;
  revokeAccess: () => Promise<{ ok: boolean; message: string }>;
  returnFunds: () => Promise<{ ok: boolean; message: string }>;

  staked: boolean;
  skrBalance: number;
  checkingSkr: boolean;
  refreshSkrTier: () => Promise<void>;
  tier: typeof TIERS.free;

  agentAddress: string;
  agentBalanceSol: number;
  funding: boolean;
  fundError: string | null;
  fundAgent: (solAmount: number) => Promise<boolean>;
  refreshAgentBalance: () => Promise<number>;

  transactions: Transaction[];
  runNow: () => Promise<{ ok: boolean; error: string | null }>;
  runError: string | null;
  forceBackgroundCheck: () => Promise<{
    result: AgentCheckResult | null;
    error: string | null;
  }>;

  nextRunLabel: string;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

const DEFAULT_RULE: Rule = {
  enabled: true,
  amountUsd: 10,
  frequency: "weekly",
  capUsd: 50,
};

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [balanceSol, setBalanceSol] = useState(0);
  const [rule, setRule] = useState<Rule>(DEFAULT_RULE);
  const [skrBalance, setSkrBalance] = useState(0);
  const [checkingSkr, setCheckingSkr] = useState(false);
  const staked = skrBalance >= SKR_HOLD_THRESHOLD;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);
  const [airdropError, setAirdropError] = useState<string | null>(null);
  const [agentPublicKey, setAgentPublicKey] = useState<PublicKey | null>(null);
  const [agentKeypair, setAgentKeypair] = useState<Keypair | null>(null);
  const [agentBalanceSol, setAgentBalanceSol] = useState(0);
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // The agent's own key is generated once, locally, the first time the app
  // runs — it doesn't depend on the main wallet being connected.
  useEffect(() => {
    getOrCreateAgentKeypair().then((kp) => {
      setAgentPublicKey(kp.publicKey);
      setAgentKeypair(kp);
    });
  }, []);

  // Hydrate rule/staked/transactions from persisted storage, and re-arm the
  // background task if a rule was already enabled from a previous session
  // — otherwise every app restart would silently stop the agent.
  useEffect(() => {
    (async () => {
      const [persistedRule, persistedTx] = await Promise.all([
        loadRule(),
        loadTransactions(),
      ]);
      if (persistedRule) setRule(persistedRule);
      if (persistedTx) {
        // Drop the old demo seed rows (ids tx1..tx3) that earlier builds saved.
        const MOCK_IDS = ["tx1", "tx2", "tx3"];
        setTransactions(persistedTx.filter((t) => !MOCK_IDS.includes(t.id)));
      }
      if (persistedRule?.enabled) await registerAgentBackgroundTask();
    })();
  }, []);

  // Keep persisted storage in sync so the background task (which runs
  // outside this React tree entirely) always reads current values.
  useEffect(() => {
    saveRule(rule);
    if (rule.enabled) registerAgentBackgroundTask();
    else unregisterAgentBackgroundTask();
  }, [rule]);

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveMainWalletAddress(publicKey ? publicKey.toBase58() : null);
  }, [publicKey]);

  // Load the agent's real balance as soon as its key is ready. Without this,
  // the balance reads 0 after every app reload until you tap Refresh, which
  // also keeps the "Return funds" button disabled.
  useEffect(() => {
    if (!agentPublicKey) return;
    getSolBalance(agentPublicKey)
      .then(setAgentBalanceSol)
      .catch(() => {});
  }, [agentPublicKey]);

  const walletConnected = publicKey !== null;
  const tier = staked ? TIERS.staked : TIERS.free;

  const completeOnboarding = () => setHasOnboarded(true);

  const connectWallet = async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      setConnectError(
        "Mobile Wallet Adapter only works on Android (this is expected — Solana Mobile targets Android/Seeker).",
      );
      return false;
    }
    setConnecting(true);
    setConnectError(null);
    try {
      const result = await authorizeWallet();
      setPublicKey(result.publicKey);
      setAuthToken(result.authToken);

      const sol = await getSolBalance(result.publicKey);
      setBalanceSol(sol);

      // Check the real SKR balance as soon as we know which wallet this is.
      getSkrBalance(result.publicKey)
        .then(setSkrBalance)
        .catch(() => {});

      return true;
    } catch (err: any) {
      setConnectError(
        err?.message ?? "Couldn't connect wallet. Is a wallet app installed?",
      );
      return false;
    } finally {
      setConnecting(false);
    }
  };

  const pauseAgent = () => setRule((r) => ({ ...r, enabled: false }));
  const resumeAgent = () => setRule((r) => ({ ...r, enabled: true }));
  const returnFunds = async (): Promise<{ ok: boolean; message: string }> => {
    if (!agentKeypair)
      return { ok: false, message: "The agent key isn't ready yet." };
    if (!publicKey)
      return {
        ok: false,
        message:
          "Connect your wallet first, so there's somewhere to send the funds.",
      };
    try {
      const { sol } = await sweepAgentFunds(agentKeypair, publicKey);
      setAgentBalanceSol(await getSolBalance(agentKeypair.publicKey));
      setBalanceSol(await getSolBalance(publicKey));
      return {
        ok: true,
        message: `Returned ${sol.toFixed(4)} SOL to your main wallet.`,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message ?? "Couldn't return the funds. Try again.",
      };
    }
  };

  const revokeAccess = async (): Promise<{ ok: boolean; message: string }> => {
    // Kill switch: stop the agent immediately, with no network dependency.
    setRule((r) => ({ ...r, enabled: false }));

    // Only destroy the key once its funds are safe — otherwise they'd be stranded.
    if (agentKeypair) {
      try {
        const sol = await getSolBalance(agentKeypair.publicKey);
        if (sol > 0.000005) {
          if (!publicKey) {
            return {
              ok: false,
              message: `Agent paused. It still holds ${sol.toFixed(4)} SOL and your wallet isn't connected, so the key was kept. Connect your wallet and revoke again to return the funds first.`,
            };
          }
          await sweepAgentFunds(agentKeypair, publicKey);
        }
      } catch (err: any) {
        return {
          ok: false,
          message: `Agent paused, but its funds couldn't be returned (${err?.message ?? "unknown error"}). The key was kept so nothing is lost — try again.`,
        };
      }
    }

    // Safe to rotate: destroy the old key and immediately create a fresh one.
    await deleteAgentKeypair();
    const fresh = await getOrCreateAgentKeypair();
    setAgentPublicKey(fresh.publicKey);
    setAgentKeypair(fresh);
    setAgentBalanceSol(0);
    setPublicKey(null);
    setAuthToken(null);
    return {
      ok: true,
      message:
        "Agent revoked. Remaining funds were returned to your wallet and the old key was destroyed.",
    };
  };
  const refreshSkrTier = async () => {
    if (!publicKey) return;
    setCheckingSkr(true);
    try {
      const balance = await getSkrBalance(publicKey);
      setSkrBalance(balance);
    } catch {
      // Leave last known value on a transient RPC error.
    } finally {
      setCheckingSkr(false);
    }
  };

  const refreshBalance = async () => {
    if (!publicKey) return;
    try {
      const sol = await getSolBalance(publicKey);
      setBalanceSol(sol);
    } catch {
      // Devnet RPC can be flaky — leave the last known balance on screen
      // rather than clearing it.
    }
  };

  const getDevnetSol = async () => {
    if (!publicKey) return;
    setRequestingAirdrop(true);
    setAirdropError(null);
    try {
      await requestDevnetAirdrop(publicKey, 1);
      const sol = await getSolBalance(publicKey);
      setBalanceSol(sol);
    } catch (err: any) {
      setAirdropError(
        err?.message?.includes("429")
          ? "Devnet faucet is rate-limited right now — try faucet.solana.com instead, or wait a bit."
          : (err?.message ?? "Airdrop failed. Try again in a moment."),
      );
    } finally {
      setRequestingAirdrop(false);
    }
  };

  const refreshAgentBalance = async (): Promise<number> => {
    if (!agentPublicKey) return agentBalanceSol;
    try {
      const sol = await getSolBalance(agentPublicKey);
      setAgentBalanceSol(sol);
      return sol;
    } catch {
      // leave last known value on transient RPC errors
      return agentBalanceSol;
    }
  };

  const fundAgent = async (solAmount: number): Promise<boolean> => {
    if (!publicKey || !authToken || !agentPublicKey) {
      setFundError("Connect your wallet first.");
      return false;
    }
    setFunding(true);
    setFundError(null);
    try {
      await fundAgentWallet(authToken, publicKey, agentPublicKey, solAmount);
      // fundAgentWallet already waits for on-chain confirmation, so the
      // balance below is guaranteed to reflect the transfer.
      const sol = await getSolBalance(agentPublicKey);
      setAgentBalanceSol(sol);
      return true;
    } catch (err: any) {
      setFundError(err?.message ?? "Funding the agent failed. Try again.");
      return false;
    } finally {
      setFunding(false);
    }
  };

  const runNow = async (): Promise<{ ok: boolean; error: string | null }> => {
    if (!agentKeypair) {
      const msg = "Agent key isn't ready yet.";
      setRunError(msg);
      return { ok: false, error: msg };
    }
    if (agentBalanceSol < 0.002) {
      const msg =
        "Agent needs at least ~0.002 SOL. Fund it from Settings first.";
      setRunError(msg);
      return { ok: false, error: msg };
    }
    setRunError(null);
    try {
      // executeAgentAction decides devnet-placeholder vs real-mainnet-swap
      // based on the single NETWORK switch in wallet.ts — this button
      // always does the same real thing the background task would do.
      const returnTo = publicKey ?? agentKeypair.publicKey;
      const result = await executeAgentAction(agentKeypair, returnTo);
      console.log(
        "[runNow] result:",
        result.description,
        "| full signature:",
        result.signature,
      );

      const cappedUsd = Math.min(rule.amountUsd, tier.capUsd);
      const tx: Transaction = {
        id: "tx" + Date.now(),
        label: `Manual run (${tier.name} tier, $${cappedUsd} cap)`,
        dateLabel: "Just now",
        amountUsd: cappedUsd,
        solAmount: result.solAmount,
        auto: true,
        txHash:
          result.signature.slice(0, 4) + "..." + result.signature.slice(-4),
      };
      setTransactions((prev) => [tx, ...prev]);

      const sol = await getSolBalance(agentKeypair.publicKey);
      setAgentBalanceSol(sol);
      return { ok: true, error: null };
    } catch (err: any) {
      const msg =
        err?.message ??
        "The agent's autonomous action failed. Check its balance and try again.";
      setRunError(msg);
      return { ok: false, error: msg };
    }
  };

  /**
   * Runs the exact same decision logic the real background task uses
   * (respecting frequency, last-run time, and balance), but on demand —
   * since Android's real background schedule can take anywhere from
   * minutes to hours to actually fire, which makes it painful to test or
   * demo live.
   */
  const forceBackgroundCheck = async (): Promise<{
    result: AgentCheckResult | null;
    error: string | null;
  }> => {
    try {
      const result = await maybeRunAgent();
      if (result === "ran") {
        const [tx, sol] = await Promise.all([
          loadTransactions(),
          getSolBalance(agentPublicKey!),
        ]);
        if (tx) setTransactions(tx);
        setAgentBalanceSol(sol);
      }
      return { result, error: null };
    } catch (err: any) {
      const message =
        err?.message ?? "The background check failed unexpectedly.";
      setRunError(message);
      return { result: null, error: message };
    }
  };

  const nextRunLabel = rule.enabled
    ? rule.frequency === "weekly"
      ? "Next Monday, 9:00 AM"
      : "Tomorrow, 9:00 AM"
    : "Paused";

  const value = useMemo(
    () => ({
      hasOnboarded,
      completeOnboarding,
      walletConnected,
      walletAddress: publicKey
        ? truncateAddress(publicKey.toBase58())
        : "Not connected",
      connecting,
      connectError,
      connectWallet,
      refreshBalance,
      requestingAirdrop,
      airdropError,
      getDevnetSol,
      balanceSol,
      solPrice: MOCK_SOL_PRICE,
      rule,
      setRule,
      pauseAgent,
      resumeAgent,
      revokeAccess,
      returnFunds,
      staked,
      skrBalance,
      checkingSkr,
      refreshSkrTier,
      tier,
      agentAddress: agentPublicKey
        ? truncateAddress(agentPublicKey.toBase58())
        : "Not created",
      agentBalanceSol,
      funding,
      fundError,
      fundAgent,
      refreshAgentBalance,
      transactions,
      runNow,
      runError,
      forceBackgroundCheck,
      nextRunLabel,
    }),
    [
      hasOnboarded,
      walletConnected,
      publicKey,
      connecting,
      connectError,
      balanceSol,
      rule,
      skrBalance,
      checkingSkr,
      transactions,
      tier,
      nextRunLabel,
      requestingAirdrop,
      airdropError,
      agentPublicKey,
      agentKeypair,
      agentBalanceSol,
      funding,
      fundError,
      runError,
    ],
  );

  return (
    <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
