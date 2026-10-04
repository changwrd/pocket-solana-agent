import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useAgent } from "@/state/AgentContext";
import { Badge, Card, SectionHeader, StatBox } from "@/components/Basics";
import PocketButton from "@/components/PocketButton";
import ActivityRow from "@/components/ActivityRow";
import { IS_MAINNET } from "@/services/wallet";
import { TIERS } from "@/data/mockData";

export default function Home() {
  const {
    rule,
    nextRunLabel,
    balanceSol,
    agentBalanceSol,
    staked,
    tier,
    transactions,
    runNow,
    walletAddress,
    walletConnected,
    connectWallet,
  } = useAgent();

  const [running, setRunning] = React.useState(false);

  const handleRunNow = async () => {
    setRunning(true);
    const { ok, error } = await runNow();
    setRunning(false);
    if (ok) {
      Alert.alert(
        "Ran automatically",
        IS_MAINNET
          ? "The agent signed and sent a real swap on mainnet — no approval needed."
          : "The agent signed and sent a real devnet transaction — no approval needed.",
      );
    } else if (error) {
      Alert.alert("Couldn't run", error);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-1">
        <View className="flex-row items-center gap-1.5">
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: colors.accent,
            }}
          />
          <Text
            style={{ color: colors.ink }}
            className="text-[17px] font-extrabold"
          >
            Pocket
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (!walletConnected) connectWallet();
          }}
          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="wallet" size={13} color={colors.dim} />
          <Text style={{ color: colors.dim }} className="text-xs font-bold">
            {walletAddress}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
        {IS_MAINNET && (
          <View
            className="rounded-xl2 px-3 py-2.5 mt-3 mb-1 flex-row items-center gap-2"
            style={{
              backgroundColor: "rgba(255,107,94,0.14)",
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <Ionicons name="warning" size={16} color={colors.danger} />
            <Text
              style={{ color: colors.danger }}
              className="text-xs font-bold flex-1"
            >
              MAINNET — this is real money, not a test network.
            </Text>
          </View>
        )}
        <Text
          style={{ color: colors.ink }}
          className="text-2xl font-extrabold mt-3 mb-4"
        >
          Your agent{"\n"}is {rule.enabled ? "working" : "paused"}.
        </Text>

        <Card accent={rule.enabled}>
          <View className="flex-row items-center justify-between mb-2">
            <Badge
              text={rule.enabled ? "ACTIVE" : "PAUSED"}
              icon={rule.enabled ? "flash" : "pause"}
              variant={rule.enabled ? "accent" : "neutral"}
            />
            {staked && (
              <Badge text="Holds SKR" icon="trending-up" variant="accent" />
            )}
          </View>
          <Text
            style={{ color: colors.ink }}
            className="text-[15px] font-bold mt-1"
          >
            ${rule.amountUsd} of SOL, every{" "}
            {rule.frequency === "weekly" ? "week" : "day"}
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs mt-1">
            {nextRunLabel} · cap ${tier.capUsd} ·{" "}
            {tier.frequencyLabel.toLowerCase()}
          </Text>
        </Card>

        <View className="flex-row gap-3 mb-1">
          <StatBox label="Your SOL" value={`${balanceSol.toFixed(3)}`} />
          <StatBox label="Agent SOL" value={`${agentBalanceSol.toFixed(4)}`} />
        </View>

        <View className="mt-3 mb-1">
          <PocketButton
            label={running ? "Running…" : "Run now (demo)"}
            icon="flash"
            onPress={handleRunNow}
            disabled={running || agentBalanceSol < 0.002}
          />
        </View>
        {agentBalanceSol < 0.002 && (
          <Text style={{ color: colors.dim }} className="text-xs mb-2">
            Fund the agent in Settings first — it needs a small SOL balance to
            act on its own.
          </Text>
        )}
        <View className="mt-2">
          <PocketButton
            label="Edit rule"
            variant="secondary"
            icon="options"
            onPress={() => router.push("/set-rule")}
          />
        </View>

        <SectionHeader title="SKR" />
        <Card>
          <Text
            style={{ color: colors.ink }}
            className="text-[13.5px] font-semibold mb-1"
          >
            {staked
              ? `Holding enough SKR — agent runs ${TIERS.staked.frequencyLabel.toLowerCase()} with a $${TIERS.staked.capUsd} cap.`
              : "Hold SKR to unlock daily checks and a higher cap."}
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs mb-3">
            This checks your wallet's real SKR balance on-chain — it isn't a
            switch in the app.
          </Text>
          <PocketButton
            label={staked ? "View SKR tier" : "Check my SKR balance"}
            variant={staked ? "secondary" : "primary"}
            icon="trending-up"
            onPress={() => router.push("/stake")}
          />
        </Card>

        <SectionHeader title="Recent activity" right="See all" />
        {transactions.slice(0, 3).map((tx) => (
          <ActivityRow key={tx.id} tx={tx} />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
