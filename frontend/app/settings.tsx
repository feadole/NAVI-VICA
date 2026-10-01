/* Settings — mockup 05. Voice speed, text size, language, needs,
   people, bracelet, and a gentle start-over. Every change persists
   immediately and VICA confirms the important ones out loud. */
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, Alert, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, radius, space, type } from "../theme";
import {
  Card, Row, SectionLabel, StatusChip, ScreenHeader, Toggle, PillButton,
} from "../components/ui";
import {
  EyeIcon, SpeakerIcon, WalkIcon, BookIcon, HeartPulseIcon, ChatIcon, SunIcon,
  PhoneIcon, BraceletIcon, CheckIcon, GlobeIcon, PlusIcon, XIcon,
} from "../components/icons";
import { getState, setState, subscribe, uid, AppState, Contact } from "../lib/store";
import { speak } from "../lib/speech";

function useAppState(): AppState {
  const [s, setS] = useState<AppState>(getState());
  useEffect(() => subscribe(setS), []);
  return s;
}

const RATES: { label: string; value: number; say: string }[] = [
  { label: "Slower", value: 0.85, say: "A little slower — like this." },
  { label: "Normal", value: 1.0, say: "Back to my normal pace — like this." },
  { label: "Faster", value: 1.15, say: "A little faster — like this." },
];

const SIZES: { label: string; value: number; aa: number; say: string }[] = [
  { label: "Normal", value: 1, aa: 17, say: "Normal text size." },
  { label: "Large", value: 1.15, aa: 21, say: "Large text — easier on the eyes." },
  { label: "Extra large", value: 1.3, aa: 26, say: "Extra large text." },
];

const LANGS: { code: string; label: string; say: string }[] = [
  { code: "en", label: "English", say: "English it is." },
  { code: "ru", label: "Русский", say: "Хорошо, говорим по-русски." },
];

const NEEDS: { key: string; label: string; icon: React.ReactNode; bg: string }[] = [
  { key: "vision", label: "Vision", icon: <EyeIcon size={22} color={colors.terraDeep} />, bg: colors.terraSoft },
  { key: "hearing", label: "Hearing", icon: <SpeakerIcon size={22} color={colors.amberDeep} />, bg: colors.amberSoft },
  { key: "motor", label: "Moving around", icon: <WalkIcon size={22} color={colors.greenDeep} />, bg: colors.greenSoft },
  { key: "cognitive", label: "Memory & focus", icon: <BookIcon size={22} color={colors.purple} />, bg: colors.purpleSoft },
  { key: "chronic", label: "Long-term illness", icon: <HeartPulseIcon size={22} color={colors.red} />, bg: colors.redSoft },
  { key: "speech", label: "Speech", icon: <ChatIcon size={22} color={colors.terraDeep} />, bg: colors.terraFaintBg },
  { key: "mood", label: "Mood", icon: <SunIcon size={22} color={colors.amberDeep} />, bg: colors.amberSoft },
];

export default function SettingsScreen() {
  const s = useAppState();
  const { profile, contacts } = s;
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  function setRate(r: typeof RATES[number]) {
    setState((st) => ({ profile: { ...st.profile, voiceRate: r.value } }));
    speak(r.say);
  }
  function setSize(sz: typeof SIZES[number]) {
    setState((st) => ({ profile: { ...st.profile, textScale: sz.value } }));
    speak(sz.say);
  }
  function setLang(l: typeof LANGS[number]) {
    setState((st) => ({ profile: { ...st.profile, language: l.code } }));
    speak(l.say);
  }
  function toggleNeed(key: string, on: boolean) {
    setState((st) => ({
      profile: {
        ...st.profile,
        conditions: on
          ? [...st.profile.conditions.filter((c) => c !== key), key]
          : st.profile.conditions.filter((c) => c !== key),
      },
    }));
  }
  function addContact() {
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name || !phone) return;
    const c: Contact = { id: uid(), name, phone };
    setState((st) => ({ contacts: [...st.contacts, c] }));
    setNewName(""); setNewPhone("");
    speak(`${name} added to your people.`);
  }
  function removeContact(c: Contact) {
    setState((st) => ({ contacts: st.contacts.filter((x) => x.id !== c.id) }));
  }
  function startOver() {
    Alert.alert(
      "Start over?",
      "This takes you back to the very first setup. Your medicines and people stay saved.",
      [
        { text: "Keep everything", style: "cancel" },
        {
          text: "Start over",
          style: "destructive",
          onPress: () => {
            setState((st) => ({ profile: { ...st.profile, setupDone: false } }));
            router.replace("/" as never);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {/* who this phone belongs to */}
        <Card style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileLetter}>{(profile.name || "?").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            <Text style={type.bodyBold}>{profile.name || "Not set up yet"}</Text>
            <Text style={type.sub}>
              {profile.conditions.length
                ? `${profile.conditions.length} need${profile.conditions.length > 1 ? "s" : ""} noted · Saved on this phone`
                : "Saved on this phone"}
            </Text>
          </View>
        </Card>

        {/* VICA'S VOICE */}
        <Card style={styles.section}>
          <SectionLabel>VICA's voice</SectionLabel>
          <View style={styles.pillGrid}>
            {RATES.map((r) => {
              const on = profile.voiceRate === r.value;
              return (
                <Pressable
                  key={r.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Speaking speed ${r.label}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => setRate(r)}
                  style={({ pressed }) => [styles.choicePill, on && styles.choicePillOn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <PillButton
            kind="soft" height={52}
            label="Hear a sample"
            icon={<SpeakerIcon size={22} color={colors.ink} />}
            onPress={() => speak("Hello! This is how I sound at this speed. Comfortable?")}
          />
        </Card>

        {/* TEXT SIZE */}
        <Card style={styles.section}>
          <SectionLabel>Text size</SectionLabel>
          <View style={styles.pillGrid}>
            {SIZES.map((sz) => {
              const on = profile.textScale === sz.value;
              return (
                <Pressable
                  key={sz.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Text size ${sz.label}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => setSize(sz)}
                  style={({ pressed }) => [styles.choicePill, on && styles.choicePillOn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn, { fontSize: sz.aa }]}>Aa</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={type.sub}>Normal · Large · Extra large</Text>
        </Card>

        {/* LANGUAGE */}
        <Card style={styles.section}>
          <SectionLabel>Language</SectionLabel>
          <View style={{ gap: space.gapSm }}>
            {LANGS.map((l) => (
              <Row
                key={l.code}
                icon={<GlobeIcon size={22} color={colors.terraDeep} />}
                iconBg={colors.terraFaintBg}
                title={l.label}
                onPress={() => setLang(l)}
                right={profile.language === l.code
                  ? <CheckIcon size={24} color={colors.green} strokeWidth={2.5} />
                  : undefined}
              />
            ))}
          </View>
        </Card>

        {/* MY NEEDS */}
        <Card style={styles.section}>
          <SectionLabel>My needs</SectionLabel>
          <View style={{ gap: space.gapSm }}>
            {NEEDS.map((n) => {
              const on = profile.conditions.includes(n.key);
              return (
                <Row
                  key={n.key}
                  icon={n.icon} iconBg={n.bg}
                  title={n.label}
                  right={<Toggle value={on} onChange={(v) => toggleNeed(n.key, v)} />}
                />
              );
            })}
          </View>
        </Card>

        {/* MY PEOPLE */}
        <Card style={styles.section}>
          <SectionLabel>My people</SectionLabel>
          {contacts.length === 0 ? (
            <Text style={type.sub}>No one added yet — add a daughter, son, or carer below.</Text>
          ) : (
            <View style={{ gap: space.gapSm }}>
              {contacts.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityLabel={`${c.name}, ${c.phone}. Long press to remove.`}
                  onLongPress={() => removeContact(c)}
                >
                  <Row
                    icon={<PhoneIcon size={22} color={colors.greenDeep} />} iconBg={colors.greenSoft}
                    title={c.name} subtitle={c.phone}
                    right={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${c.name}`}
                        hitSlop={12}
                        onPress={() => removeContact(c)}
                        style={({ pressed }) => [styles.removeChip, pressed && { opacity: 0.7 }]}
                      >
                        <XIcon size={16} color={colors.red} />
                      </Pressable>
                    }
                  />
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ gap: space.gapSm }}>
            <TextInput
              value={newName} onChangeText={setNewName}
              placeholder="Name" placeholderTextColor={colors.faint}
              accessibilityLabel="New person's name"
              style={styles.input}
            />
            <TextInput
              value={newPhone} onChangeText={setNewPhone}
              placeholder="Phone number" placeholderTextColor={colors.faint}
              accessibilityLabel="New person's phone number"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <PillButton
              kind="outline" height={52}
              label="Add this person"
              icon={<PlusIcon size={20} color={colors.terraDeep} />}
              onPress={addContact}
            />
          </View>
        </Card>

        {/* MY BRACELET */}
        <Card style={styles.section}>
          <SectionLabel>My bracelet</SectionLabel>
          {profile.braceletName ? (
            <Row
              icon={<BraceletIcon size={22} color={colors.purple} />} iconBg={colors.purpleSoft}
              title={profile.braceletName}
              subtitle="Watching your pulse"
              right={<StatusChip label="Connected" tone="ok" />}
            />
          ) : (
            <Row
              icon={<BraceletIcon size={22} color={colors.purple} />} iconBg={colors.purpleSoft}
              title="Not connected"
              subtitle="Tap to pair your pulse bracelet"
              onPress={() => router.push("/pair" as never)}
              right={<StatusChip label="Set up" tone="warn" />}
            />
          )}
        </Card>

        {/* START OVER */}
        <Card style={styles.section}>
          <SectionLabel>Start over</SectionLabel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start over from the first setup"
            onPress={startOver}
            style={({ pressed }) => [styles.dangerPill, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.dangerText}>Start over from the beginning</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.screen, paddingTop: 4, gap: 14, paddingBottom: 40 },

  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.terraSoft,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  profileLetter: { fontFamily: font.heading, fontSize: 24, color: colors.terraDeep },

  section: { padding: 16, gap: 14 },

  pillGrid: { flexDirection: "row", gap: 10 },
  choicePill: {
    flexGrow: 1, flexBasis: 0, height: 56, borderRadius: 16,
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.fieldBorder,
    alignItems: "center", justifyContent: "center",
  },
  choicePillOn: {
    backgroundColor: colors.terraSoft, borderWidth: 2.5, borderColor: colors.terra,
  },
  choiceText: { fontFamily: font.bodyBold, fontSize: 16, color: colors.ink },
  choiceTextOn: { color: colors.ink },

  input: {
    height: 54, paddingHorizontal: 16, borderRadius: radius.chip,
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.fieldBorder,
    fontFamily: font.body, fontSize: 17, color: colors.ink,
  },

  removeChip: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.redFaint,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  dangerPill: {
    height: 58, borderRadius: 29, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.redSoft,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 18,
  },
  dangerText: { fontFamily: font.bodyBold, fontSize: 19, color: colors.red },
});
