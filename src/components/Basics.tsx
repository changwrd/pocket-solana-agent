import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

export function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <View
      className="rounded-xl2 p-4 mb-3"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: accent ? colors.accent : colors.border,
      }}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View className="flex-row items-center justify-between mt-5 mb-2">
      <Text style={{ color: colors.ink }} className="text-[15px] font-bold">
        {title}
      </Text>
      {right ? (
        <Text style={{ color: colors.dim }} className="text-[13px] font-semibold">
          {right}
        </Text>
      ) : null}
    </View>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-xl2 p-3.5"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ color: colors.ink }} className="text-xl font-extrabold">
        {value}
      </Text>
      <Text style={{ color: colors.dim }} className="text-xs font-semibold mt-0.5">
        {label}
      </Text>
    </View>
  );
}

type BadgeVariant = "accent" | "neutral" | "danger";

export function Badge({
  text,
  icon,
  variant = "accent",
}: {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: BadgeVariant;
}) {
  const bg = variant === "accent" ? "rgba(57,255,198,0.14)" : variant === "danger" ? colors.dangerDim : colors.surface2;
  const fg = variant === "accent" ? colors.accent : variant === "danger" ? colors.danger : colors.dim;
  return (
    <View
      className="flex-row items-center self-start gap-1.5 rounded-full px-2.5 py-1.5"
      style={{ backgroundColor: bg, borderWidth: variant === "neutral" ? 1 : 0, borderColor: colors.border }}
    >
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={{ color: fg }} className="text-[11.5px] font-bold">
        {text}
      </Text>
    </View>
  );
}
