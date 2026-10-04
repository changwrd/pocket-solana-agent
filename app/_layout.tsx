import "../global.css";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { AgentProvider } from "@/state/AgentContext";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      ...Ionicons.font,
    })
      .then(() => setFontsReady(true))
      .catch((err) => {
        console.error("Failed to load Ionicons font:", err);

        setFontsReady(true);
      });
  }, []);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <AgentProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="set-rule"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Edit rule",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.ink,
          }}
        />
        <Stack.Screen
          name="stake"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "SKR staking",
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.ink,
          }}
        />
      </Stack>
    </AgentProvider>
  );
}
