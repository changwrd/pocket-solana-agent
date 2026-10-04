import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import PocketButton from "@/components/PocketButton";
import { useAgent } from "@/state/AgentContext";

const STEPS = [
  {
    icon: "flash" as const,
    title: "Meet your Pocket agent.",
    body: "A tiny AI helper that buys a little crypto for you automatically — so you don't have to remember to.",
  },
  {
    icon: "shield-checkmark" as const,
    title: "It only holds a small, limited key.",
    body: "Pocket never touches your main wallet. It gets a separate key with a spending cap you set — like handing someone a gift card instead of your whole account.",
  },
  {
    icon: "time" as const,
    title: "It runs on a schedule, by itself.",
    body: 'Set a rule once — like "$10 of SOL every Monday" — and Pocket does it automatically, even if the app is closed.',
  },
  {
    icon: "wallet" as const,
    title: "Connect your wallet",
    body: "Pocket generates a separate key on this device, encrypted by Android's own secure hardware — your main wallet never leaves your wallet app.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { connectWallet, completeOnboarding, connecting, connectError } =
    useAgent();
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  const finish = async () => {
    const ok = await connectWallet();
    if (ok) {
      completeOnboarding();
      router.replace("/(tabs)");
    }
    // On failure, connectError is set and rendered below — user can retry.
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="flex-row gap-1.5 mb-7">
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 4,
                  backgroundColor: i === step ? colors.accent : colors.border,
                }}
              />
            ))}
          </View>

          <View
            className="w-16 h-16 rounded-2xl items-center justify-center mb-7"
            style={{ backgroundColor: "rgba(57,255,198,0.14)" }}
          >
            <Ionicons name={s.icon} size={28} color={colors.accent} />
          </View>

          <Text
            style={{ color: colors.ink }}
            className="text-2xl font-extrabold text-center mb-3"
          >
            {s.title}
          </Text>
          <Text
            style={{ color: colors.dim }}
            className="text-[14.5px] text-center leading-5"
          >
            {s.body}
          </Text>
        </View>

        <View className="px-7 pb-9">
          {isLast ? (
            <>
              {connectError && (
                <Text
                  style={{ color: colors.danger }}
                  className="text-xs text-center mb-3 leading-4"
                >
                  {connectError}
                </Text>
              )}
              <View className="mb-3">
                {connecting ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : (
                  <PocketButton
                    label="Connect Wallet"
                    icon="wallet"
                    onPress={finish}
                  />
                )}
              </View>
            </>
          ) : (
            <PocketButton
              label="Continue"
              onPress={() => setStep((v) => v + 1)}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
