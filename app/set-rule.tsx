import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useAgent } from "@/state/AgentContext";
import { Card, Badge } from "@/components/Basics";
import PocketButton from "@/components/PocketButton";
import { Frequency } from "@/types";
import { structureRuleFromText } from "@/services/ai";

const AMOUNTS = [5, 10, 20, 50];
const CAPS = [25, 50, 100, 200];

export default function SetRule() {
  const { rule, setRule } = useAgent();
  const [amount, setAmount] = useState(rule.amountUsd);
  const [frequency, setFrequency] = useState<Frequency>(rule.frequency);
  const [cap, setCap] = useState(rule.capUsd);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  const askAi = async () => {
    setAiLoading(true);
    setAiApplied(false);
    try {
      const result = await structureRuleFromText(aiText);

      setAmount(result.amountUsd);
      setFrequency(result.frequency);
      setAiApplied(true);
    } catch (err: any) {
      Alert.alert(
        "Couldn't understand that",
        err?.message ?? "Try rephrasing, or set it manually below.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const save = () => {
    setRule({ enabled: true, amountUsd: amount, frequency, capUsd: cap });
    router.back();
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["bottom"]}
    >
      <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false}>
        <Text
          style={{ color: colors.ink }}
          className="text-[13.5px] font-bold mb-2"
        >
          Describe it in your own words
        </Text>
        <TextInput
          value={aiText}
          onChangeText={setAiText}
          placeholder='e.g. "buy $25 of SOL every day"'
          placeholderTextColor={colors.faint}
          className="rounded-xl2 px-4 py-3 mb-2"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.ink,
          }}
        />
        <View className="mb-2">
          {aiLoading ? (
            <View className="py-3 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <PocketButton
              label="Ask AI"
              icon="sparkles"
              variant="secondary"
              onPress={askAi}
              disabled={!aiText.trim()}
            />
          )}
        </View>
        {aiApplied && (
          <View className="mb-4">
            <Badge
              text={`AI understood: $${amount} every ${frequency === "daily" ? "day" : "week"} — review below`}
              icon="checkmark-circle"
            />
          </View>
        )}

        <View
          style={{ height: 1, backgroundColor: colors.border }}
          className="mb-5 mt-1"
        />

        <Text
          style={{ color: colors.ink }}
          className="text-2xl font-extrabold text-center my-2"
        >
          ${amount}
        </Text>
        <Text
          style={{ color: colors.dim }}
          className="text-center text-xs mb-5"
        >
          of SOL, {frequency === "weekly" ? "every week" : "every day"}
        </Text>

        <Text
          style={{ color: colors.ink }}
          className="text-[13.5px] font-bold mb-2"
        >
          Amount per run
        </Text>
        <View className="flex-row gap-2 mb-5">
          {AMOUNTS.map((a) => (
            <Chip
              key={a}
              label={`$${a}`}
              active={amount === a}
              onPress={() => {
                setAmount(a);
                setAiApplied(false);
              }}
            />
          ))}
        </View>

        <Text
          style={{ color: colors.ink }}
          className="text-[13.5px] font-bold mb-2"
        >
          Frequency
        </Text>
        <View className="flex-row gap-2 mb-5">
          <Chip
            label="Daily"
            active={frequency === "daily"}
            onPress={() => {
              setFrequency("daily");
              setAiApplied(false);
            }}
            flex
          />
          <Chip
            label="Weekly"
            active={frequency === "weekly"}
            onPress={() => {
              setFrequency("weekly");
              setAiApplied(false);
            }}
            flex
          />
        </View>

        <Text
          style={{ color: colors.ink }}
          className="text-[13.5px] font-bold mb-2"
        >
          Total spending cap
        </Text>
        <View className="flex-row gap-2 mb-2">
          {CAPS.map((c) => (
            <Chip
              key={c}
              label={`$${c}`}
              active={cap === c}
              onPress={() => setCap(c)}
            />
          ))}
        </View>

        <Card>
          <Text style={{ color: colors.dim }} className="text-xs">
            Pocket can never spend more than ${cap} total without you approving
            again — this is enforced by the delegated key's own limit, not just
            the app.
          </Text>
        </Card>
      </ScrollView>

      <View className="px-5 pb-3 pt-2">
        <PocketButton label="Save rule" onPress={save} />
      </View>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  flex,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  flex?: boolean;
}) {
  return (
    <View style={flex ? { flex: 1 } : undefined}>
      <PocketButton
        label={label}
        variant={active ? "primary" : "secondary"}
        onPress={onPress}
      />
    </View>
  );
}
