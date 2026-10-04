import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useAgent } from "@/state/AgentContext";
import { Badge, Card, SectionHeader } from "@/components/Basics";
import PocketButton from "@/components/PocketButton";
import { getDebugInfo } from "@/services/backgroundTask";
import { clearLastRunAt } from "@/services/persist";

const FUND_AMOUNTS = [0.01, 0.02, 0.05, 0.1];

export default function Settings() {
  const {
    rule,
    pauseAgent,
    resumeAgent,
    revokeAccess,
    returnFunds,
    tier,
    staked,
    walletAddress,
    walletConnected,
    agentAddress,
    agentBalanceSol,
    funding,
    fundError,
    fundAgent,
    refreshAgentBalance,
    forceBackgroundCheck,
  } = useAgent();
  const [fundAmount, setFundAmount] = useState(0.02);
  const [refreshingAgent, setRefreshingAgent] = useState(false);
  const [checkingBackground, setCheckingBackground] = useState(false);

  const onRefreshAgent = async () => {
    setRefreshingAgent(true);
    const sol = await refreshAgentBalance();
    setRefreshingAgent(false);
    Alert.alert("Refreshed", `Agent balance is now ${sol.toFixed(4)} SOL.`);
  };

  const onForceBackgroundCheck = async () => {
    setCheckingBackground(true);
    const { result, error } = await forceBackgroundCheck();
    setCheckingBackground(false);
    if (error) {
      Alert.alert("Background check failed", error);
    } else if (result === "ran") {
      Alert.alert(
        "Ran automatically",
        "The agent checked in, decided it was due, and acted on its own — exactly what the real background schedule will do.",
      );
    } else if (result === "low_balance") {
      Alert.alert(
        "Agent is out of funds",
        "It needs at least 0.002 SOL to act. Fund it above.",
      );
    } else if (result === "disabled") {
      Alert.alert("Agent is paused", "Resume the agent to let it run.");
    } else {
      Alert.alert(
        "Not due yet",
        "The rule's schedule hasn't elapsed since the last run.",
      );
    }
  };

  const [busy, setBusy] = useState(false);

  const onReturnFunds = () => {
    Alert.alert(
      "Return funds to your wallet?",
      "The agent will send everything it holds back to your main wallet. It keeps running with an empty balance until you fund it again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Return funds",
          onPress: async () => {
            setBusy(true);
            const { ok, message } = await returnFunds();
            setBusy(false);
            Alert.alert(ok ? "Done" : "Couldn't return funds", message);
          },
        },
      ],
    );
  };

  const onShowDebugInfo = async () => {
    const info = await getDebugInfo();
    console.log(info);
    Alert.alert(
      "Debug info",
      `Rule enabled: ${info.ruleEnabled}\n` +
        `Rule frequency (as set): ${info.ruleFrequency}\n` +
        `Holds enough SKR: ${info.holdsSkr}\n` +
        `Real tier: ${info.tier} (cap $${info.effectiveCapUsd})\n` +
        `Effective frequency (enforced): ${info.effectiveFrequency}\n` +
        `Last run: ${info.lastRunAgo}\n` +
        `Due now: ${info.dueNow} (else in ${info.dueInSeconds}s)\n` +
        `Agent balance: ${info.agentBalanceSol.toFixed(4)} SOL\n` +
        `Saved transactions: ${info.persistedTransactionCount}\n` +
        `OS task registered: ${info.osTaskRegistered}`,
    );
  };

  const onResetSchedule = async () => {
    await clearLastRunAt();
    Alert.alert(
      "Schedule reset",
      "The agent will treat the next check as due, regardless of frequency.",
    );
  };

  const confirmRevoke = () => {
    Alert.alert(
      "Revoke agent access?",
      "The agent stops immediately. Any funds it still holds are sent back to your main wallet first, then its key is destroyed and a fresh one is created.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            const { ok, message } = await revokeAccess();
            Alert.alert(ok ? "Agent revoked" : "Agent paused", message);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <View className="px-5 pt-2 pb-1">
        <Text
          style={{ color: colors.ink }}
          className="text-[22px] font-extrabold"
        >
          Settings
        </Text>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
        <SectionHeader title="Agent status" />
        <Card>
          <View className="flex-row items-center justify-between mb-3">
            <Badge
              text={rule.enabled ? "ACTIVE" : "PAUSED"}
              icon={rule.enabled ? "flash" : "pause"}
              variant={rule.enabled ? "accent" : "neutral"}
            />
            <Text
              style={{ color: colors.dim }}
              className="text-xs font-semibold"
            >
              {staked ? tier.name + " tier" : tier.name + " tier"}
            </Text>
          </View>
          {rule.enabled ? (
            <PocketButton
              label="Pause agent"
              variant="secondary"
              icon="pause"
              onPress={pauseAgent}
            />
          ) : (
            <PocketButton
              label="Resume agent"
              icon="play"
              onPress={resumeAgent}
            />
          )}
          {rule.enabled && (
            <View className="mt-2">
              <PocketButton
                label={
                  checkingBackground ? "Checking…" : "Simulate background check"
                }
                variant="ghost"
                icon="time"
                onPress={onForceBackgroundCheck}
                disabled={checkingBackground}
              />
            </View>
          )}
        </Card>

        <SectionHeader title="Spending limits" />
        <Card>
          <Row label="Per run" value={`$${rule.amountUsd}`} />
          <Row
            label="Frequency"
            value={rule.frequency === "weekly" ? "Weekly" : "Daily"}
          />
          <Row label="Hard cap" value={`$${rule.capUsd} total`} last />
          <View className="mt-3">
            <PocketButton
              label="Edit rule"
              variant="secondary"
              icon="options"
              onPress={() => router.push("/set-rule")}
            />
          </View>
        </Card>

        <SectionHeader title="Delegated agent key" />
        <Card>
          <Text
            style={{ color: colors.ink }}
            className="text-[13.5px] font-semibold mb-1"
          >
            {agentAddress}
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs mb-3">
            A separate key, generated on this device and encrypted by Android's
            secure hardware storage (Keystore). It can only ever spend what you
            fund it with below — it has no access to the rest of your wallet.
          </Text>

          <View
            className="flex-row items-center justify-between py-2"
            style={{ borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <Text
              style={{ color: colors.dim }}
              className="text-xs font-semibold"
            >
              Agent balance
            </Text>
            <Text
              style={{ color: colors.ink }}
              className="text-[13.5px] font-extrabold"
            >
              {agentBalanceSol.toFixed(4)} SOL
            </Text>
          </View>

          <Text
            style={{ color: colors.ink }}
            className="text-[13px] font-bold mt-3 mb-2"
          >
            Fund the agent
          </Text>
          <View className="flex-row gap-2 mb-3">
            {FUND_AMOUNTS.map((a) => (
              <View key={a} style={{ flex: 1 }}>
                <PocketButton
                  label={`${a}`}
                  variant={fundAmount === a ? "primary" : "secondary"}
                  onPress={() => setFundAmount(a)}
                />
              </View>
            ))}
          </View>

          {!walletConnected && (
            <Text style={{ color: colors.dim }} className="text-xs mb-2">
              Connect your wallet first to fund the agent.
            </Text>
          )}
          {fundError && (
            <Text
              style={{ color: colors.danger }}
              className="text-xs mb-2 leading-4"
            >
              {fundError}
            </Text>
          )}

          <View className="mb-2">
            <PocketButton
              label={
                funding
                  ? "Confirm in your wallet…"
                  : `Fund agent with ${fundAmount} SOL`
              }
              icon="arrow-forward-circle"
              disabled={!walletConnected || funding}
              onPress={async () => {
                const ok = await fundAgent(fundAmount);
                if (ok)
                  Alert.alert(
                    "Agent funded",
                    `Sent ${fundAmount} SOL to the agent's own account.`,
                  );
              }}
            />
          </View>
          <View className="mb-2">
            <PocketButton
              label={busy ? "Working…" : "Return funds to my wallet"}
              variant="secondary"
              icon="return-down-back"
              onPress={onReturnFunds}
              disabled={busy || !walletConnected || agentBalanceSol <= 0}
            />
          </View>
          {!walletConnected ? (
            <Text style={{ color: colors.dim }} className="text-xs mb-2">
              Connect your wallet to return funds.
            </Text>
          ) : agentBalanceSol <= 0 ? (
            <Text style={{ color: colors.dim }} className="text-xs mb-2">
              Agent balance reads 0 — tap "Refresh agent balance" if you expect
              funds here.
            </Text>
          ) : null}
          <PocketButton
            label={refreshingAgent ? "Refreshing…" : "Refresh agent balance"}
            variant="ghost"
            icon="refresh"
            onPress={onRefreshAgent}
            disabled={refreshingAgent}
          />
        </Card>

        <SectionHeader title="Main wallet" />
        <Card>
          <Text
            style={{ color: colors.ink }}
            className="text-[13.5px] font-semibold mb-1"
          >
            {walletAddress}
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs mb-3">
            Your real wallet, connected via Mobile Wallet Adapter. Pocket never
            holds this key — it only ever asks it to sign the one-time funding
            transfer above.
          </Text>
          <PocketButton
            label="Revoke agent access"
            variant="danger"
            icon="power"
            onPress={confirmRevoke}
          />
        </Card>

        <SectionHeader title="Debug (dev only)" />
        <Card>
          <Text style={{ color: colors.dim }} className="text-xs mb-3">
            Raw view of what's actually persisted — use this instead of guessing
            when something looks wrong.
          </Text>
          <View className="mb-2">
            <PocketButton
              label="Show debug info"
              variant="secondary"
              icon="bug"
              onPress={onShowDebugInfo}
            />
          </View>
          <PocketButton
            label="Reset schedule"
            variant="ghost"
            icon="refresh-circle"
            onPress={onResetSchedule}
          />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row items-center justify-between py-2.5"
      style={
        !last
          ? { borderBottomWidth: 1, borderBottomColor: colors.border }
          : undefined
      }
    >
      <Text style={{ color: colors.dim }} className="text-[13px] font-semibold">
        {label}
      </Text>
      <Text
        style={{ color: colors.ink }}
        className="text-[13.5px] font-extrabold"
      >
        {value}
      </Text>
    </View>
  );
}
