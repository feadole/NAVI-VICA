/* Welcome — mockup screen 01. Brand header, language pill, feature list,
   create/sign-in buttons and the floating "rather talk?" bar. */
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, radius, space, type } from "../theme";
import { Row, PillButton, Brand } from "../components/ui";
import {
  MicIcon, EyeIcon, CompassIcon, AlarmIcon, HeartPulseIcon,
  PhoneIcon, ChatIcon, GlobeIcon,
} from "../components/icons";
import { getState, setState, subscribe } from "../lib/store";
import { speak } from "../lib/speech";

/** Language pill shared by Welcome and Home headers. */
export function LanguagePill({ compact }: { compact?: boolean }) {
  const [lang, setLang] = useState(getState().profile.language);
  useEffect(() => subscribe((s) => setLang(s.profile.language)), []);
  const label = lang === "ru" ? "Русский" : "English";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change language"
      onPress={() =>
        setState((s) => ({ profile: { ...s.profile, language: s.profile.language === "ru" ? "en" : "ru" } }))}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: compact ? 6 : 8,
        height: 44, paddingHorizontal: compact ? 14 : 16, borderRadius: 22,
        borderWidth: 1.5, borderColor: colors.fieldBorder, backgroundColor: colors.card,
      }, pressed && { opacity: 0.85 }]}
    >
      <GlobeIcon size={compact ? 18 : 20} color={colors.ink} />
      <Text style={{ fontFamily: font.bodyBold, fontSize: compact ? 15 : 16, color: colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Floating "Rather talk?" bar — shared by Welcome and Home. */
export function TalkBar() {
  return (
    <View style={{
      position: "absolute", left: space.screen, right: space.screen, bottom: 16,
      flexDirection: "row", alignItems: "center", gap: space.gap,
      paddingVertical: 8, paddingLeft: 18, paddingRight: 8,
      borderRadius: 40, backgroundColor: colors.card,
      shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 }, elevation: 8,
    }}>
      <Text style={{
        flexGrow: 1, flexShrink: 1, fontFamily: font.body,
        fontSize: 15, lineHeight: 20, color: colors.muted,
      }}>
        Rather talk? Ask me anything.
      </Text>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Chat with VICA"
        onPress={() => router.push("/chat")}
        style={({ pressed }) => [{
          width: 52, height: 52, borderRadius: 26, borderWidth: 2,
          borderColor: colors.fieldBorder, backgroundColor: colors.bg,
          alignItems: "center", justifyContent: "center",
        }, pressed && { opacity: 0.85 }]}
      >
        <ChatIcon size={24} color={colors.terraDeep} />
      </Pressable>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Talk to VICA"
        onPress={() => router.push("/listen")}
        style={({ pressed }) => [{
          width: 60, height: 60, borderRadius: 30, backgroundColor: colors.terra,
          alignItems: "center", justifyContent: "center",
        }, pressed && { opacity: 0.85 }]}
      >
        <MicIcon size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

const FEATURES: { icon: React.ReactNode; bg: string; title: string }[] = [
  { icon: <EyeIcon size={22} color={colors.terraDeep} />, bg: colors.terraSoft, title: "Tells you what is around you" },
  { icon: <CompassIcon size={22} color={colors.green} />, bg: colors.greenSoft, title: "Walks you where you need to go" },
  { icon: <AlarmIcon size={22} color={colors.amber} />, bg: colors.amberSoft, title: "Remembers your medicines" },
  { icon: <HeartPulseIcon size={22} color={colors.purple} />, bg: colors.purpleSoft, title: "Watches your pulse and blood pressure" },
  { icon: <PhoneIcon size={22} color={colors.red} />, bg: colors.redSoft, title: "Reaches your family in one tap" },
];

let welcomed = false; // speak only on first mount per app session

export default function Welcome() {
  useEffect(() => {
    if (getState().profile.setupDone) {
      router.replace("/home");
      return;
    }
    if (!welcomed) {
      welcomed = true;
      speak("Hello, I'm VICA. A calm companion who helps you see, find your way, and look after your health.");
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: space.screen, paddingTop: 16, paddingBottom: 8,
      }}>
        <Brand />
        <LanguagePill />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.screen, paddingTop: 6, paddingBottom: 110, gap: space.gapLg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space.gapSm }}>
          <Text style={[type.big, { marginTop: 4 }]}>Hello, I'm VICA.</Text>
          <Text style={{ fontFamily: font.body, fontSize: 19, lineHeight: 27, color: colors.muted }}>
            A calm companion who helps you see, find your way and look after your health.
          </Text>
        </View>

        <View style={{ gap: space.gapSm }}>
          {FEATURES.map((f) => (
            <Row key={f.title} icon={f.icon} iconBg={f.bg} title={f.title} />
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <PillButton
            label="Create my account"
            onPress={() => router.push("/setup")}
          />
          <PillButton
            label="I already have an account"
            kind="outline"
            onPress={() => {
              if (getState().profile.setupDone) router.replace("/home");
              else router.push("/setup");
            }}
          />
        </View>
      </ScrollView>

      <TalkBar />
    </SafeAreaView>
  );
}
