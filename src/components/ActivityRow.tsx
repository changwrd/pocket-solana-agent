import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { Transaction } from "@/types";

export default function ActivityRow({ tx }: { tx: Transaction }) {
  return (
    <Pressable
      onPress={() =>
        Alert.alert(
          "Transaction",
          `${tx.label}\n\nHash: ${tx.txHash}\n\n(In the real app this opens Solana Explorer.)`
        )
      }
      className="flex-row items-center py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: colors.surface2 }}
      >
        <Ionicons
          name={tx.auto ? "flash" : "arrow-down-circle"}
          size={17}
          color={colors.accent}
        />
      </View>
      <View className="flex-1">
        <Text style={{ color: colors.ink }} className="text-[13.5px] font-bold">
          {tx.label}
        </Text>
        <Text style={{ color: colors.dim }} className="text-xs mt-0.5">
          {tx.dateLabel} {tx.solAmount ? `· ${tx.solAmount} SOL` : ""}
        </Text>
      </View>
      <Text style={{ color: tx.auto ? colors.accent : colors.dim }} className="text-[13.5px] font-extrabold">
        {tx.auto ? "-" : "+"}${tx.amountUsd}
      </Text>
    </Pressable>
  );
}
