/* Screen 10 — My health. Pulse right now, blood pressure, bracelet row,
   7-bar pulse sparkline, manual reading entry, and an alert test link. */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, radius, space, type } from "../theme";
import { Card, IconChip, PillButton, SectionLabel, StatusChip } from "../components/ui";
import {
  HeartPulseIcon, GaugeIcon, BraceletIcon, BackIcon, ChevronRightIcon, PlusIcon,
} from "../components/icons";
import { getState, subscribe, AppState } from "../lib/store";
import { speak } from "../lib/speech";
import { braceletConnected, record, simulateHighPulse, LIMITS } from "../lib/health";

function timeAgo(at: number | null): string {
  if (!at) return "no reading yet";
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins} min ago`;
  const d = new Date(at);
  return `updated at ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HealthScreen() {
  const [state, setAppState] = useState<AppState>(getState());
  const [pulseIn, setPulseIn] = useState("");
  const [sysIn, setSysIn] = useState("");
  const [diaIn, setDiaIn] = useState("");
  const spoke = useRef(false);

  useEffect(() => subscribe(setAppState), []);

  useEffect(() => {
    if (spoke.current) return;
    const v = getState().vitals;
    if (v.pulse != null && v.sys != null && v.dia != null) {
      spoke.current = true;
      const calm =
        v.pulse < LIMITS.pulseHigh && v.pulse > LIMITS.pulseLow &&
        v.sys < LIMITS.sysHigh && v.dia < LIMITS.diaHigh;
      speak(
        `Your pulse is ${v.pulse} and blood pressure ${v.sys} over ${v.dia}` +
        (calm ? " — all looking calm." : ". I'm keeping a close eye on it.")
      );
    }
  }, []);

  const { vitals, vitalsLog, profile } = state;
  const connected = braceletConnected();

  const pulseTone =
    vitals.pulse == null ? "ok"
      : vitals.pulse >= LIMITS.pulseHigh || vitals.pulse <= LIMITS.pulseLow ? "bad"
      : "ok";

  /* last 7 pulse readings for the sparkline */
  const bars = vitalsLog.filter((e) => e.pulse != null).slice(-7).map((e) => e.pulse!);
  const barMin = Math.min(...bars, 55);
  const barMax = Math.max(...bars, 90);

  const saveReading = () => {
    const pulse = parseInt(pulseIn, 10);
    const sys = parseInt(sysIn, 10);
    const dia = parseInt(diaIn, 10);
    const v: { pulse?: number; sys?: number; dia?: number } = {};
    if (!Number.isNaN(pulse)) v.pulse = pulse;
    if (!Number.isNaN(sys)) v.sys = sys;
    if (!Number.isNaN(dia)) v.dia = dia;
    if (!Object.keys(v).length) return;
    record(v);
    setPulseIn(""); setSysIn(""); setDiaIn("");
    speak("Saved. Thank you for telling me.");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      {/* header: back chip + red-soft heart chip + title, like the mockup */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: space.screen, paddingTop: 10, paddingBottom: 8,
      }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [{
            width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terraFaintBg,
            alignItems: "center", justifyContent: "center",
          }, pressed && { opacity: 0.8 }]}>
          <BackIcon size={22} color={colors.ink} />
        </Pressable>
        <IconChip bg={colors.redSoft} size={44}>
          <HeartPulseIcon size={24} color={colors.red} />
        </IconChip>
        <Text style={type.h3}>My health</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.screen, paddingTop: 4, gap: space.gap }}
        keyboardShouldPersistTaps="handled">

        {/* bracelet row */}
        {connected ? (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 12,
            paddingVertical: 12, paddingHorizontal: 14,
            borderRadius: 20, backgroundColor: colors.greenSoft,
          }}>
            <IconChip bg={colors.purpleSoft} size={44}>
              <BraceletIcon size={24} color={colors.purple} />
            </IconChip>
            <View style={{ flexGrow: 1, flexShrink: 1 }}>
              <Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: colors.greenDeep }}>
                {profile.braceletName ?? "Pulse bracelet"}
              </Text>
              <Text style={{ fontFamily: font.body, fontSize: 14, color: colors.greenDeep }}>
                {timeAgo(vitals.at)}
              </Text>
            </View>
            <StatusChip label="Connected" tone="ok" />
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push("/pair")}
            style={({ pressed }) => [{
              flexDirection: "row", alignItems: "center", gap: 12,
              paddingVertical: 12, paddingHorizontal: 14,
              borderRadius: 20, backgroundColor: colors.card,
              borderWidth: 1.5, borderColor: colors.cardBorder,
            }, pressed && { opacity: 0.85 }]}>
            <IconChip bg={colors.purpleSoft} size={44}>
              <BraceletIcon size={24} color={colors.purple} />
            </IconChip>
            <View style={{ flexGrow: 1 }}>
              <Text style={type.bodyBold}>Connect your bracelet</Text>
              <Text style={type.sub}>So VICA can read your pulse for you</Text>
            </View>
            <ChevronRightIcon size={22} color={colors.faint} />
          </Pressable>
        )}

        {/* PULSE RIGHT NOW */}
        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Pulse right now</SectionLabel>
            <StatusChip
              label={pulseTone === "bad" ? "Check" : "Normal"}
              tone={pulseTone === "bad" ? "bad" : "ok"}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <IconChip bg={colors.redSoft} size={44}>
              <HeartPulseIcon size={24} color={colors.red} />
            </IconChip>
            <Text style={{ fontFamily: font.heading, fontSize: 64, lineHeight: 68, color: colors.ink }}>
              {vitals.pulse ?? "—"}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 18, color: colors.muted }}>bpm</Text>
          </View>

          {/* 7-bar sparkline from recent readings */}
          {bars.length > 0 ? (
            <>
              <View style={{
                flexDirection: "row", alignItems: "flex-end", gap: 6,
                height: 56, paddingTop: 4,
              }}>
                {bars.map((p, i) => {
                  const h = 12 + ((p - barMin) / Math.max(1, barMax - barMin)) * 40;
                  const worried = p >= 100 || p <= 55;
                  return (
                    <View key={i} style={{
                      flex: 1, height: h, borderRadius: 5,
                      backgroundColor: worried ? colors.amberSoft : colors.greenSoft,
                      borderWidth: 1.5,
                      borderColor: worried ? colors.amber : colors.green,
                    }} />
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={type.sub}>Earlier</Text>
                <Text style={type.sub}>Now</Text>
              </View>
            </>
          ) : (
            <Text style={type.sub}>Readings will appear here as VICA collects them.</Text>
          )}
        </Card>

        {/* BLOOD PRESSURE */}
        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <SectionLabel>Blood pressure</SectionLabel>
            <Text style={type.sub}>{timeAgo(vitals.at)}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <IconChip bg={colors.purpleSoft} size={44}>
              <GaugeIcon size={24} color={colors.purple} />
            </IconChip>
            <Text style={{ fontFamily: font.heading, fontSize: 48, lineHeight: 52, color: colors.ink }}>
              {vitals.sys != null && vitals.dia != null ? `${vitals.sys}/${vitals.dia}` : "—"}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 16, color: colors.muted }}>mmHg</Text>
          </View>
        </Card>

        {/* manual entry */}
        <Card style={{ padding: 16, gap: 10 }}>
          <Text style={type.bodyBold}>Add a reading</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={pulseIn} onChangeText={setPulseIn}
              placeholder="Pulse" placeholderTextColor={colors.faint}
              keyboardType="number-pad" accessibilityLabel="Pulse"
              style={[inputStyle, { flex: 1 }]}
            />
            <TextInput
              value={sysIn} onChangeText={setSysIn}
              placeholder="Sys" placeholderTextColor={colors.faint}
              keyboardType="number-pad" accessibilityLabel="Systolic blood pressure"
              style={[inputStyle, { flex: 1 }]}
            />
            <TextInput
              value={diaIn} onChangeText={setDiaIn}
              placeholder="Dia" placeholderTextColor={colors.faint}
              keyboardType="number-pad" accessibilityLabel="Diastolic blood pressure"
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
          <PillButton
            label="Save reading" kind="primary" height={52}
            icon={<PlusIcon size={20} color={colors.white} />}
            onPress={saveReading}
          />
        </Card>

        {/* reassurance note from the mockup */}
        <View style={{
          flexDirection: "row", gap: 10, padding: 14,
          borderRadius: radius.chip, backgroundColor: colors.terraFaintBg,
        }}>
          <Text style={[type.sub, { fontSize: 15, color: colors.ink, flex: 1 }]}>
            If your pulse goes above {LIMITS.pulseHigh} or below {LIMITS.pulseLow}, VICA checks
            on you, then calls your family if you don't answer.
          </Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => simulateHighPulse()}
          style={({ pressed }) => [{
            minHeight: 44, alignItems: "center", justifyContent: "center",
          }, pressed && { opacity: 0.7 }]}>
          <Text style={[type.sub, { textDecorationLine: "underline" }]}>Test the alert</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  minHeight: 52,
  borderRadius: radius.chip,
  borderWidth: 1.5,
  borderColor: colors.fieldBorder,
  backgroundColor: colors.bg,
  paddingHorizontal: 14,
  fontFamily: font.body,
  fontSize: 17,
  color: colors.ink,
} as const;
