import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useAgent } from "@/state/AgentContext";
import { Card, SectionHeader } from "@/components/Basics";
import PocketButton from "@/components/PocketButton";
import { IS_MAINNET } from "@/services/wallet";

export default function Wallet() {
  const {
    balanceSol,
    solPrice,
    walletAddress,
    refreshBalance,
    requestingAirdrop,
    airdropError,
    getDevnetSol,
  } = useAgent();
  const [refreshing, setRefreshing] = useState(false);
  const estimatedUsd = balanceSol * solPrice;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
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
          Wallet
        </Text>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
        <Card>
          <Text
            style={{ color: colors.dim }}
            className="text-xs font-semibold mb-1"
          >
            SOL balance {IS_MAINNET ? "(mainnet)" : "(devnet)"}
          </Text>
          <Text
            style={{ color: colors.ink }}
            className="text-[32px] font-extrabold"
          >
            {balanceSol.toFixed(4)}
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs mt-1">
            ≈ ${estimatedUsd.toFixed(2)} at a reference price of ${solPrice}/SOL
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs mt-2">
            Secured via Mobile Wallet Adapter · {walletAddress}
          </Text>
        </Card>

        <View className="mt-3">
          <PocketButton
            label={refreshing ? "Refreshing…" : "Refresh SOL balance"}
            variant="secondary"
            icon="refresh"
            onPress={onRefresh}
            disabled={refreshing}
          />
        </View>

        {!IS_MAINNET && (
          <View className="mt-2">
            <PocketButton
              label={requestingAirdrop ? "Requesting…" : "Get devnet SOL"}
              variant="ghost"
              icon="water"
              onPress={getDevnetSol}
              disabled={requestingAirdrop}
            />
          </View>
        )}
        {airdropError && (
          <Text
            style={{ color: colors.danger }}
            className="text-xs mt-2 leading-4"
          >
            {airdropError}
          </Text>
        )}

        <SectionHeader title="Security" />
        <Card>
          <Text
            style={{ color: colors.ink }}
            className="text-[13.5px] font-semibold mb-1"
          >
            Your main wallet's key never leaves your wallet app
          </Text>
          <Text style={{ color: colors.dim }} className="text-xs">
            Pocket only ever holds a separate, spend-capped key — it can never
            move more than your rule allows.
          </Text>
        </Card>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
