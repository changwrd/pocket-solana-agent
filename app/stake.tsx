import React from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { useAgent } from "@/state/AgentContext";
import { TIERS } from "@/data/mockData";
import { SKR_HOLD_THRESHOLD } from "@/services/skr";
import { Card } from "@/components/Basics";
import PocketButton from "@/components/PocketButton";

export default function Stake() {
  const { staked, skrBalance, checkingSkr, refreshSkrTier, walletConnected } =
    useAgent();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["bottom"]}
    >
      <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="items-center mb-5">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mb-3"
            style={{ backgroundColor: "rgba(57,255,198,0.14)" }}
          >
            <Ionicons name="trending-up" size={24} color={colors.accent} />
          </View>
          <Text
            style={{ color: colors.ink }}
            className="text-lg font-extrabold text-center"
          >
            Hold SKR to unlock more
          </Text>
          <Text
            style={{ color: colors.dim }}
            className="text-center text-xs mt-1 leading-4"
          >
            This checks your wallet's real SKR balance on-chain — it isn't a
            switch in the app. Get SKR into your wallet, then check again.
          </Text>
        </View>

        <View className="mb-4">
          <Card>
            <Text
              style={{ color: colors.dim }}
              className="text-xs font-semibold mb-1"
            >
              Your wallet's SKR balance
            </Text>
            <Text
              style={{ color: colors.ink }}
              className="text-2xl font-extrabold"
            >
              {skrBalance.toFixed(2)} SKR
            </Text>
            <Text style={{ color: colors.dim }} className="text-xs mt-1">
              Needs {SKR_HOLD_THRESHOLD}+ SKR to unlock the higher tier.
            </Text>
          </Card>
        </View>

        <TierCard tier={TIERS.free} isCurrent={!staked} />
        <TierCard tier={TIERS.staked} isCurrent={staked} highlight />

        {!walletConnected && (
          <Text style={{ color: colors.dim }} className="text-xs mt-2">
            Connect your wallet first to check your SKR balance.
          </Text>
        )}
      </ScrollView>

      <View className="px-5 pb-3 pt-2">
        <PocketButton
          label={checkingSkr ? "Checking…" : "Check my SKR balance"}
          icon="refresh"
          disabled={checkingSkr || !walletConnected}
          onPress={async () => {
            await refreshSkrTier();
            router.back();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function TierCard({
  tier,
  isCurrent,
  highlight,
}: {
  tier: typeof TIERS.free;
  isCurrent: boolean;
  highlight?: boolean;
}) {
  return (
    <Card accent={isCurrent && highlight}>
      <View className="flex-row items-center justify-between mb-2">
        <Text
          style={{ color: colors.ink }}
          className="text-[15px] font-extrabold"
        >
          {tier.name}
        </Text>
        {isCurrent && (
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: "rgba(57,255,198,0.14)" }}
          >
            <Text
              style={{ color: colors.accent }}
              className="text-[11px] font-bold"
            >
              Current
            </Text>
          </View>
        )}
      </View>
      <Row label="Check frequency" value={tier.frequencyLabel} />
      <Row label="Spending cap" value={`$${tier.capUsd}`} />
      <Row label="Fees" value={tier.feeLabel} last />
    </Card>
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
      className="flex-row items-center justify-between py-2"
      style={
        !last
          ? { borderBottomWidth: 1, borderBottomColor: colors.border }
          : undefined
      }
    >
      <Text style={{ color: colors.dim }} className="text-xs font-semibold">
        {label}
      </Text>
      <Text style={{ color: colors.ink }} className="text-xs font-extrabold">
        {value}
      </Text>
    </View>
  );
}
