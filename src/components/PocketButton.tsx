import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

const styles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.accent, text: colors.accentInk },
  secondary: { bg: colors.surface, text: colors.ink, border: colors.border },
  ghost: { bg: "transparent", text: colors.dim, border: colors.border },
  danger: { bg: colors.dangerDim, text: colors.danger },
};

export default function PocketButton({ label, onPress, variant = "primary", icon, disabled }: Props) {
  const s = styles[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-full flex-row items-center justify-center gap-2 rounded-full py-4 px-5"
      style={{
        backgroundColor: s.bg,
        borderWidth: s.border ? 1 : 0,
        borderColor: s.border,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon && <Ionicons name={icon} size={17} color={s.text} />}
      <Text style={{ color: s.text }} className="font-bold text-[14.5px]">
        {label}
      </Text>
    </Pressable>
  );
}
