import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useAgent } from "@/state/AgentContext";
import ActivityRow from "@/components/ActivityRow";
import { Card } from "@/components/Basics";

export default function Activity() {
  const { transactions } = useAgent();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View className="px-5 pt-2 pb-3">
        <Text style={{ color: colors.ink }} className="text-[22px] font-extrabold">
          Activity
        </Text>
        <Text style={{ color: colors.dim }} className="text-[13px] mt-1">
          Everything your agent has done, automatically.
        </Text>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? (
          <Card>
            <Text style={{ color: colors.ink }} className="font-bold mb-1">
              No activity yet
            </Text>
            <Text style={{ color: colors.dim }} className="text-xs">
              Once your rule runs, purchases will show up here.
            </Text>
          </Card>
        ) : (
          transactions.map((tx) => <ActivityRow key={tx.id} tx={tx} />)
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
