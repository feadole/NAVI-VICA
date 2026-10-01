/* Screen M4 — Pulse alert. VICA checks on you: big heart, the worrying
   value, a 60-second countdown, then a call to family if no answer. */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { colors, font, type } from "../theme";
import { PillButton } from "../components/ui";
import { HeartPulseIcon, PhoneIcon } from "../components/icons";
import { getState, logEvent } from "../lib/store";
import { speak, stop } from "../lib/speech";

const TITLES: Record<string, string> = {
  "pulse-high": "Your pulse is high",
  "pulse-low": "Your pulse is low",
  "bp-high": "Your blood pressure is high",
};

export default function PulseAlertScreen() {
  const params = useLocalSearchParams<{ kind?: string; value?: string }>();
  const kind = (Array.isArray(params.kind) ? params.kind[0] : params.kind) ?? "pulse-high";
  const value = (Array.isArray(params.value) ? params.value[0] : params.value) ?? "";
  const isBp = kind === "bp-high";
  const title = TITLES[kind] ?? TITLES["pulse-high"];

  const [secs, setSecs] = useState(60);
  const doneRef = useRef(false);

  const name = getState().profile.name;
  const question = `Are you feeling okay${name ? `, ${name}` : ""}?`;

  useEffect(() => {
    speak(`${title}. ${question} If you don't answer in one minute, I will call your family.`);
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => { clearInterval(t); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (doneRef.current) return;
    if (secs === 30) speak(`${question} Please tap I'm okay if you're fine.`);
    if (secs === 0) {
      doneRef.current = true;
      const first = getState().contacts[0];
      logEvent("auto_call", first ? `${first.name} after ${kind}` : `no contact after ${kind}`);
      if (first) {
        speak("I couldn't hear you, so I'm calling your family now.");
        Linking.openURL(`tel:${first.phone}`).catch(() => {});
      } else {
        speak("I couldn't hear you, and I have no family number saved. Please call for help if you need it.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs]);

  const imOkay = () => {
    doneRef.current = true;
    logEvent("alert_ok", kind);
    speak("Thank goodness. I'll keep watching quietly.");
    router.back();
  };

  const callFamily = () => {
    doneRef.current = true;
    const first = getState().contacts[0];
    logEvent("call", first ? first.name : "112");
    Linking.openURL(`tel:${first ? first.phone : "112"}`).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 24 }}>
        {/* heart circle with soft halo */}
        <View style={{
          marginTop: 64, width: 182, height: 182, borderRadius: 91,
          backgroundColor: colors.redFaint, alignItems: "center", justifyContent: "center",
        }}>
          <View style={{
            width: 150, height: 150, borderRadius: 75, backgroundColor: colors.redSoft,
            alignItems: "center", justifyContent: "center",
          }}>
            <HeartPulseIcon size={70} color={colors.red} />
          </View>
        </View>

        <Text style={{
          marginTop: 28, fontFamily: font.bodyBold, fontSize: 17, color: colors.red,
        }}>
          {title}
        </Text>

        <Text style={{
          fontFamily: font.heading, fontSize: isBp ? 56 : 64, lineHeight: isBp ? 62 : 70,
          color: colors.ink,
        }}>
          {value}
          {!isBp ? (
            <Text style={{ fontFamily: font.body, fontSize: 22, color: colors.muted }}> bpm</Text>
          ) : null}
        </Text>

        <Text style={{
          marginTop: 14, fontFamily: font.heading, fontSize: 28, lineHeight: 34,
          color: colors.ink, textAlign: "center",
        }}>
          {question}
        </Text>
        <Text style={[type.body, { marginTop: 8, color: colors.muted, textAlign: "center" }]}>
          If you don't answer in 1 minute, I will call your family.
        </Text>

        <Text style={{
          marginTop: 12, fontFamily: font.heading, fontSize: 26, color: colors.terraDeep,
        }}>
          {secs}
        </Text>

        {/* buttons pinned to the bottom */}
        <View style={{
          position: "absolute", left: 24, right: 24, bottom: 24, gap: 12,
        }}>
          <PillButton label="I'm okay" kind="green" height={64} onPress={imOkay} />
          <PillButton
            label="Call my family" kind="red" height={58}
            icon={<PhoneIcon size={22} color={colors.white} />}
            onPress={callFamily}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
