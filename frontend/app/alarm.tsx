/* In-app medicine alarm — mockup M3 "Lock screen medicine alarm".
   Dark full-bleed screen, spoken and vibrating until answered. */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Vibration } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { colors, font } from "../theme";
import { IconChip, PillButton } from "../components/ui";
import { AlarmIcon, CheckIcon } from "../components/icons";
import { getState, logEvent } from "../lib/store";
import { markTaken, snooze } from "../lib/alarms";
import { speak, stop as stopSpeaking } from "../lib/speech";

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function AlarmScreen() {
  const { medId } = useLocalSearchParams<{ medId: string }>();
  const med = getState().medicines.find((m) => m.id === medId);
  const medName = med?.name ?? "your medicine";
  const [now, setNow] = useState(new Date());
  const announceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Vibration.vibrate([0, 500, 300, 500], true);
    const userName = getState().profile.name;
    const line = userName
      ? `Time for your medicine, ${userName}. ${medName}.`
      : `Time for your medicine. ${medName}.`;
    speak(line);
    announceRef.current = setInterval(() => speak(line), 15_000);
    const clock = setInterval(() => setNow(new Date()), 1_000);
    logEvent("alarm_shown", medName);
    return () => {
      Vibration.cancel();
      if (announceRef.current) clearInterval(announceRef.current);
      clearInterval(clock);
      stopSpeaking();
    };
  }, [medId]);

  function dismiss() {
    Vibration.cancel();
    if (announceRef.current) clearInterval(announceRef.current);
  }

  function tookIt() {
    dismiss();
    if (med) markTaken(med.id);
    speak("Well done.");
    router.back();
  }

  function remindLater() {
    dismiss();
    if (med) snooze(med.name, med.id);
    speak("Alright — I'll remind you again in ten minutes.");
    logEvent("alarm_snoozed", medName);
    router.back();
  }

  const dateLine = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.lockBg, alignItems: "center" }}
      edges={["top", "bottom"]}
    >
      <Text
        style={{
          marginTop: 46, fontFamily: font.body, fontSize: 18,
          color: colors.white, opacity: 0.8,
        }}
      >
        {dateLine}
      </Text>
      <Text
        style={{
          fontFamily: font.heading, fontSize: 84, lineHeight: 92, color: colors.white,
        }}
      >
        {pad2(now.getHours())}:{pad2(now.getMinutes())}
      </Text>

      {/* Amber alarm circle with soft ring */}
      <View
        style={{
          marginTop: 40,
          width: 148, height: 148, borderRadius: 74,
          backgroundColor: "rgba(246,227,184,0.18)",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <IconChip bg={colors.amberSoft} size={120}>
          <AlarmIcon color={colors.amber} size={56} />
        </IconChip>
      </View>

      <View style={{ marginTop: 28, alignItems: "center", paddingHorizontal: 30 }}>
        <Text
          style={{
            fontFamily: font.bodyBold, fontSize: 17, color: colors.white, opacity: 0.8,
          }}
        >
          Time for your medicine
        </Text>
        <Text
          style={{
            fontFamily: font.heading, fontSize: 34, lineHeight: 41,
            color: colors.white, marginTop: 6, textAlign: "center",
          }}
        >
          {medName}
        </Text>
        <Text
          style={{
            fontFamily: font.body, fontSize: 18, lineHeight: 25,
            color: colors.white, opacity: 0.85, marginTop: 8, textAlign: "center",
          }}
        >
          VICA is saying this out loud and the phone is vibrating.
        </Text>
      </View>

      {/* Actions pinned to the bottom */}
      <View
        style={{
          position: "absolute", left: 24, right: 24, bottom: 44, gap: 12,
        }}
      >
        <PillButton
          label="I took it"
          kind="lockLight"
          height={64}
          icon={<CheckIcon color={colors.ink} size={24} />}
          onPress={tookIt}
        />
        <PillButton
          label="Remind me in 10 minutes"
          kind="lockGhost"
          height={58}
          onPress={remindLater}
        />
      </View>
    </SafeAreaView>
  );
}
