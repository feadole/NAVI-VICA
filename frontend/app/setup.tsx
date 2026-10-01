/* Setup — four-step wizard. Step 2 is mockup M1 (permissions).
   Name → permissions → conditions → emergency contact. */
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import { colors, font, radius, space, type } from "../theme";
import { Row, PillButton, Toggle } from "../components/ui";
import {
  MicIcon, CameraIcon, PinIcon, BraceletIcon, BellIcon, PhoneIcon,
  EyeIcon, SpeakerIcon, WalkIcon, BookIcon, HeartPulseIcon, ChatIcon,
  SunIcon, CheckIcon,
} from "../components/icons";
import { setState, uid, Contact } from "../lib/store";
import { speak } from "../lib/speech";
import { requestAlarmPermission } from "../lib/alarms";

type PermKey = "mic" | "camera" | "location" | "bracelet" | "alerts" | "calls";

const PERM_ROWS: {
  key: PermKey; title: string; subtitle: string;
  icon: React.ReactNode; bg: string;
}[] = [
  { key: "mic", title: "Microphone", subtitle: 'To hear "Hey VICA"',
    icon: <MicIcon size={22} color={colors.terraDeep} />, bg: colors.terraSoft },
  { key: "camera", title: "Camera", subtitle: "To see what is around you",
    icon: <CameraIcon size={22} color={colors.terraDeep} />, bg: colors.terraSoft },
  { key: "location", title: "Location", subtitle: "To guide you and share it in an emergency",
    icon: <PinIcon size={22} color={colors.green} />, bg: colors.greenSoft },
  { key: "bracelet", title: "Pulse bracelet", subtitle: "Bluetooth, to read your pulse",
    icon: <BraceletIcon size={22} color={colors.purple} />, bg: colors.purpleSoft },
  { key: "alerts", title: "Alerts", subtitle: "Medicine alarms, even when locked",
    icon: <BellIcon size={22} color={colors.amber} />, bg: colors.amberSoft },
  { key: "calls", title: "Phone calls", subtitle: "To call help for you",
    icon: <PhoneIcon size={22} color={colors.red} />, bg: colors.redSoft },
];

const CONDITION_ROWS: {
  key: string; title: string; icon: React.ReactNode; bg: string;
}[] = [
  { key: "vision", title: "Seeing", icon: <EyeIcon size={22} color={colors.terraDeep} />, bg: colors.terraSoft },
  { key: "hearing", title: "Hearing", icon: <SpeakerIcon size={22} color={colors.green} />, bg: colors.greenSoft },
  { key: "motor", title: "Moving around", icon: <WalkIcon size={22} color={colors.amber} />, bg: colors.amberSoft },
  { key: "cognitive", title: "Memory", icon: <BookIcon size={22} color={colors.purple} />, bg: colors.purpleSoft },
  { key: "chronic", title: "Health", icon: <HeartPulseIcon size={22} color={colors.red} />, bg: colors.redSoft },
  { key: "speech", title: "Speech", icon: <ChatIcon size={22} color={colors.terraDeep} />, bg: colors.terraFaintBg },
  { key: "mood", title: "Feeling lonely", icon: <SunIcon size={22} color={colors.amber} />, bg: colors.amberSoft },
];

const QUESTIONS = [
  "What should VICA call you?",
  "What can VICA use to help you?",
  "What should I help with most?",
  "Who are your people?",
];

const SUBTITLES = [
  "Your first name is enough.",
  "You can change these any time in Settings.",
  "Pick everything that applies — I'll adapt to you.",
  "One person I can reach if you ever need help.",
];

const fieldStyle = {
  backgroundColor: colors.card,
  borderWidth: 1.5,
  borderColor: colors.fieldBorder,
  borderRadius: radius.chip,
  paddingHorizontal: 16,
  paddingVertical: 14,
  minHeight: 60,
  fontFamily: font.body,
  fontSize: 19,
  color: colors.ink,
} as const;

export default function Setup() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Record<PermKey, boolean>>({
    mic: true, camera: true, location: true, bracelet: true, alerts: true, calls: true,
  });
  const [conditions, setConditions] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    speak(QUESTIONS[step - 1]);
  }, [step]);

  const finish = (extraContacts?: Contact[]) => {
    const trimmed = name.trim();
    setState((s) => ({
      profile: { ...s.profile, setupDone: true },
      ...(extraContacts ? { contacts: [...s.contacts, ...extraContacts] } : {}),
    }));
    speak(`All set${trimmed ? `, ${trimmed}` : ""}! I'm here whenever you need me.`);
    router.replace("/home");
  };

  const requestPermissions = async () => {
    const granted: Record<string, boolean> = {
      bracelet: perms.bracelet, calls: perms.calls, // stored preferences only
    };
    if (perms.mic) {
      try { granted.mic = (await Audio.requestPermissionsAsync()).status === "granted"; }
      catch { granted.mic = false; }
    } else granted.mic = false;
    if (perms.camera) {
      try { granted.camera = (await requestCameraPermission())?.granted === true; }
      catch { granted.camera = false; }
    } else granted.camera = false;
    if (perms.location) {
      try { granted.location = (await Location.requestForegroundPermissionsAsync()).status === "granted"; }
      catch { granted.location = false; }
    } else granted.location = false;
    if (perms.alerts) {
      try { granted.alerts = await requestAlarmPermission(); }
      catch { granted.alerts = false; }
    } else granted.alerts = false;
    setState((s) => ({ profile: { ...s.profile, permissions: { ...s.profile.permissions, ...granted } } }));
  };

  const onContinue = async () => {
    if (busy) return;
    if (step === 1) {
      setState((s) => ({ profile: { ...s.profile, name: name.trim() } }));
      setStep(2);
    } else if (step === 2) {
      setBusy(true);
      try { await requestPermissions(); } finally { setBusy(false); }
      setStep(3);
    } else if (step === 3) {
      setState((s) => ({ profile: { ...s.profile, conditions } }));
      setStep(4);
    } else {
      const n = contactName.trim();
      const p = contactPhone.trim();
      finish(n && p ? [{ id: uid(), name: n, phone: p }] : undefined);
    }
  };

  const continueDisabled = step === 1 && !name.trim();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: space.screen, paddingTop: 20, paddingBottom: 24, gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: font.bodyBold, fontSize: 15, color: colors.terraDeep }}>
            Step {step} of 4
          </Text>
          <Text style={type.h1}>{QUESTIONS[step - 1]}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 17, lineHeight: 24, color: colors.muted }}>
            {SUBTITLES[step - 1]}
          </Text>

          {step === 1 && (
            <TextInput
              style={fieldStyle}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.faint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onContinue}
              accessibilityLabel="Your name"
            />
          )}

          {step === 2 && (
            <View style={{ gap: space.gapSm }}>
              {PERM_ROWS.map((r) => (
                <Row
                  key={r.key}
                  icon={r.icon}
                  iconBg={r.bg}
                  title={r.title}
                  subtitle={r.subtitle}
                  right={
                    <Toggle
                      value={perms[r.key]}
                      onChange={(v) => setPerms((p) => ({ ...p, [r.key]: v }))}
                    />
                  }
                />
              ))}
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: space.gapSm }}>
              {CONDITION_ROWS.map((c) => {
                const on = conditions.includes(c.key);
                return (
                  <Row
                    key={c.key}
                    icon={c.icon}
                    iconBg={c.bg}
                    title={c.title}
                    selected={on}
                    onPress={() =>
                      setConditions((cs) =>
                        on ? cs.filter((k) => k !== c.key) : [...cs, c.key])}
                    right={on ? <CheckIcon size={24} color={colors.purple} /> : undefined}
                  />
                );
              })}
            </View>
          )}

          {step === 4 && (
            <View style={{ gap: space.gap }}>
              <TextInput
                style={fieldStyle}
                value={contactName}
                onChangeText={setContactName}
                placeholder="Their name"
                placeholderTextColor={colors.faint}
                accessibilityLabel="Contact name"
              />
              <TextInput
                style={fieldStyle}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="Their phone number"
                placeholderTextColor={colors.faint}
                keyboardType="phone-pad"
                accessibilityLabel="Contact phone number"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => finish()}
                style={({ pressed }) => [{
                  minHeight: 44, alignItems: "center", justifyContent: "center",
                }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{
                  fontFamily: font.bodyBold, fontSize: 17,
                  color: colors.terraDeep, textDecorationLine: "underline",
                }}>
                  Skip this for now
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 14 }}>
          <PillButton
            label={busy ? "One moment…" : step === 4 ? "Finish" : "Continue"}
            onPress={continueDisabled ? undefined : onContinue}
            style={continueDisabled ? { opacity: 0.5 } : undefined}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
