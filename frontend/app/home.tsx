/* Home — mockup screen 02. Greeting with the big mic, health card,
   bracelet status, 2×2 helper grid and the floating talk bar. */
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, radius, space, type } from "../theme";
import { Card, IconChip, Brand } from "../components/ui";
import {
  MicIcon, EyeIcon, CompassIcon, AlarmIcon, HeartPulseIcon,
  PhoneIcon, UserIcon, GaugeIcon,
} from "../components/icons";
import { getState, subscribe, AppState } from "../lib/store";
import { speak } from "../lib/speech";
import { LanguagePill, TalkBar } from "./index";

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function minutesAgo(at: number): string {
  const min = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (min < 1) return "just now";
  return `${min} min ago`;
}

function HelperTile({ label, icon, chipBg, onPress, emergency }: {
  label: string; icon: React.ReactNode; chipBg: string;
  onPress: () => void; emergency?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{
        flex: 1, height: 118, borderRadius: radius.tile,
        alignItems: "center", justifyContent: "center", gap: space.gapSm,
        backgroundColor: emergency ? colors.red : colors.card,
        borderWidth: emergency ? 0 : 1.5, borderColor: colors.cardBorder,
      }, pressed && { opacity: 0.85 }]}
    >
      <IconChip bg={chipBg} size={56}>{icon}</IconChip>
      <Text style={{
        fontFamily: font.bodyBold, fontSize: 20,
        color: emergency ? colors.white : colors.ink,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

let greeted = false; // speak the greeting once per app session

export default function Home() {
  const [app, setApp] = useState<AppState>(getState());
  useEffect(() => subscribe(setApp), []);

  const name = app.profile.name || "friend";
  const { vitals } = app;

  useEffect(() => {
    if (!greeted) {
      greeted = true;
      speak(`${greetingWord()}, ${name}. Say "Hey VICA" or tap the mic whenever you need me.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bp = vitals.sys != null && vitals.dia != null ? `${vitals.sys}/${vitals.dia}` : "—";
  const pulse = vitals.pulse != null ? String(vitals.pulse) : "—";
  const braceletConnected = vitals.at != null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        gap: space.gapSm, paddingHorizontal: space.screen, paddingTop: 14, paddingBottom: 4,
      }}>
        <Brand />
        <View style={{ flexDirection: "row", gap: space.gapSm }}>
          <LanguagePill compact />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My account and settings"
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [{
              width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terraSoft,
              alignItems: "center", justifyContent: "center",
            }, pressed && { opacity: 0.85 }]}
          >
            <UserIcon size={22} color={colors.terraDeep} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.screen, paddingTop: 6, paddingBottom: 110, gap: space.gap,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* greeting + big mic */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.gapLg }}>
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            <Text style={type.h2}>{greetingWord()}, {name}</Text>
            <Text style={{ fontFamily: font.body, fontSize: 17, lineHeight: 24, color: colors.muted, marginTop: 4 }}>
              Say "Hey VICA" or tap the mic
            </Text>
          </View>
          <View style={{
            borderRadius: radius.round, backgroundColor: colors.terraSoft,
            padding: 10, margin: 10, marginLeft: 0, flexShrink: 0,
          }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Talk to VICA"
              onPress={() => router.push("/listen")}
              style={({ pressed }) => [{
                width: 96, height: 96, borderRadius: 48, backgroundColor: colors.terra,
                alignItems: "center", justifyContent: "center",
              }, pressed && { opacity: 0.9 }]}
            >
              <MicIcon size={42} color={colors.white} />
            </Pressable>
          </View>
        </View>

        {/* health card: pulse | blood pressure */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`My health: pulse ${pulse}, blood pressure ${bp}`}
          onPress={() => router.push("/health")}
        >
          {({ pressed }) => (
            <Card style={[{ flexDirection: "row", overflow: "hidden" }, pressed && { opacity: 0.85 }]}>
              <View style={{
                flex: 1, paddingVertical: 12, paddingHorizontal: 14,
                flexDirection: "row", alignItems: "center", gap: space.gap,
                borderRightWidth: 1.5, borderRightColor: colors.cardBorder,
              }}>
                <IconChip bg={colors.redSoft} size={44}>
                  <HeartPulseIcon size={24} color={colors.red} />
                </IconChip>
                <View>
                  <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.muted }}>Pulse</Text>
                  <Text>
                    <Text style={{ fontFamily: font.heading, fontSize: 26, color: colors.ink }}>{pulse}</Text>
                    <Text style={{ fontFamily: font.body, fontSize: 14, color: colors.muted }}> bpm</Text>
                  </Text>
                </View>
              </View>
              <View style={{
                flex: 1, paddingVertical: 12, paddingHorizontal: 14,
                flexDirection: "row", alignItems: "center", gap: space.gap,
              }}>
                <IconChip bg={colors.purpleSoft} size={44}>
                  <GaugeIcon size={24} color={colors.purple} />
                </IconChip>
                <View>
                  <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.muted }}>Blood pressure</Text>
                  <Text style={{ fontFamily: font.heading, fontSize: 26, color: colors.ink }}>{bp}</Text>
                </View>
              </View>
            </Card>
          )}
        </Pressable>

        {/* bracelet status */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={braceletConnected ? "Bracelet connected" : "No bracelet, tap to connect"}
          onPress={() => router.push("/pair")}
          style={({ pressed }) => [{
            flexDirection: "row", alignItems: "center", gap: space.gapSm,
            minHeight: 44, marginTop: -4,
          }, pressed && { opacity: 0.7 }]}
        >
          {braceletConnected ? (
            <>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} />
              <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.green }}>
                Bracelet connected · checked {minutesAgo(vitals.at as number)}
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.muted }}>
              No bracelet — tap to connect
            </Text>
          )}
        </Pressable>

        {/* 2×2 helper grid */}
        <View style={{ gap: space.gap }}>
          <View style={{ flexDirection: "row", gap: space.gap }}>
            <HelperTile
              label="Detect"
              chipBg={colors.terraSoft}
              icon={<EyeIcon size={30} color={colors.terraDeep} />}
              onPress={() => router.push("/detect")}
            />
            <HelperTile
              label="Navigate"
              chipBg={colors.greenSoft}
              icon={<CompassIcon size={30} color={colors.green} />}
              onPress={() => router.push("/navigate")}
            />
          </View>
          <View style={{ flexDirection: "row", gap: space.gap }}>
            <HelperTile
              label="Medicines"
              chipBg={colors.amberSoft}
              icon={<AlarmIcon size={30} color={colors.amber} />}
              onPress={() => router.push("/meds")}
            />
            <HelperTile
              label="Emergency"
              emergency
              chipBg={colors.white}
              icon={<PhoneIcon size={28} color={colors.red} />}
              onPress={() => router.push("/sos")}
            />
          </View>
        </View>
      </ScrollView>

      <TalkBar />
    </SafeAreaView>
  );
}
