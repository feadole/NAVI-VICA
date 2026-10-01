/* NAVI-VICA shared UI — the mockup's building blocks.
   Cards, icon chips, pill buttons, toggles, section labels. */
import React from "react";
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, StyleProp,
} from "react-native";
import { colors, font, radius, type } from "../theme";

/* ---------- layout ---------- */

export function Card({ children, style, border = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; border?: boolean;
}) {
  return (
    <View style={[{
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: border ? 1.5 : 0,
      borderColor: colors.cardBorder,
    }, style]}>
      {children}
    </View>
  );
}

/** A mockup list row: icon chip, title + subtitle, optional right element. */
export function Row({ icon, iconBg, title, subtitle, right, onPress, style, selected }: {
  icon?: React.ReactNode; iconBg?: string; title: string; subtitle?: string;
  right?: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>;
  selected?: boolean;
}) {
  const body = (
    <>
      {icon ? <IconChip bg={iconBg ?? colors.terraFaintBg}>{icon}</IconChip> : null}
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text style={type.bodyBold}>{title}</Text>
        {subtitle ? <Text style={type.sub}>{subtitle}</Text> : null}
      </View>
      {right}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [{
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radius.chip, backgroundColor: colors.card,
    borderWidth: selected ? 2 : 1.5,
    borderColor: selected ? colors.purple : colors.cardBorder,
  }, style];
  if (onPress) {
    return <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { opacity: 0.85 }]}>{body}</Pressable>;
  }
  return <View style={rowStyle}>{body}</View>;
}

export function IconChip({ children, bg, size = 40 }: {
  children: React.ReactNode; bg: string; size?: number;
}) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {children}
    </View>
  );
}

/* ---------- controls ---------- */

export function PillButton({ label, onPress, kind = "primary", icon, style, height = 58 }: {
  label: string; onPress?: () => void;
  kind?: "primary" | "outline" | "green" | "red" | "soft" | "lockLight" | "lockGhost";
  icon?: React.ReactNode; style?: StyleProp<ViewStyle>; height?: number;
}) {
  const bg: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.terra },
    green: { backgroundColor: colors.green },
    red: { backgroundColor: colors.red },
    outline: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.terra },
    soft: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.fieldBorder },
    lockLight: { backgroundColor: colors.amberSoft },
    lockGhost: { backgroundColor: "transparent", borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },
  };
  const fg: Record<string, TextStyle> = {
    primary: { color: colors.white }, green: { color: colors.white }, red: { color: colors.white },
    outline: { color: colors.terraDeep }, soft: { color: colors.ink },
    lockLight: { color: colors.ink }, lockGhost: { color: colors.white },
  };
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [{
        height, borderRadius: height / 2, flexDirection: "row", gap: 10,
        alignItems: "center", justifyContent: "center", paddingHorizontal: 18,
      }, bg[kind], pressed && { opacity: 0.85 }, style]}>
      {icon}
      <Text style={[type.button, fg[kind]]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange?: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }}
      onPress={() => onChange?.(!value)}
      style={{
        width: 52, height: 30, borderRadius: 15, flexShrink: 0,
        backgroundColor: value ? colors.green : colors.fieldBorder,
        justifyContent: "center",
      }}>
      <View style={{
        position: "absolute", top: 3, [value ? "right" : "left"]: 3,
        width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white,
      } as ViewStyle} />
    </Pressable>
  );
}

/* ---------- text pieces ---------- */

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.label, style]}>{children}</Text>;
}

export function StatusChip({ label, tone = "ok" }: { label: string; tone?: "ok" | "warn" | "bad" }) {
  const tones = {
    ok: { bg: colors.greenSoft, fg: colors.greenDeep },
    warn: { bg: colors.amberSoft, fg: colors.amberDeep },
    bad: { bg: colors.redSoft, fg: colors.red },
  }[tone];
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: tones.bg }}>
      <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: tones.fg }}>{label}</Text>
    </View>
  );
}

/** Header used on inner screens: back chip + Fraunces title (+ optional right). */
export function ScreenHeader({ title, onBack, right }: {
  title: string; onBack?: () => void; right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
          style={({ pressed }) => [styles.backChip, pressed && { opacity: 0.8 }]}>
          <Text style={{ fontFamily: font.bodyBold, fontSize: 22, color: colors.ink }}>‹</Text>
        </Pressable>
      ) : null}
      <Text style={[type.h3, { flexGrow: 1 }]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

export function Brand() {
  return (
    <Text style={{
      fontFamily: font.heading, fontSize: 22, letterSpacing: 1.8, color: colors.terraDeep,
    }}>
      NAVI·VICA
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8,
  },
  backChip: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terraFaintBg,
    alignItems: "center", justifyContent: "center",
  },
});
