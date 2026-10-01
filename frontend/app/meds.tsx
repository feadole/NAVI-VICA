/* Medicines — mockup 08 "My medicines".
   Daily progress, medicine rows with taken state, add-with-alarm card. */
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, radius, space, type } from "../theme";
import { Card, IconChip, PillButton, ScreenHeader, SectionLabel } from "../components/ui";
import { AlarmIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from "../components/icons";
import { Medicine, getState, setState, subscribe, uid, logEvent } from "../lib/store";
import {
  scheduleMedicine, cancelMedicine, markTaken, requestAlarmPermission,
} from "../lib/alarms";
import { speak } from "../lib/speech";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmt = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;

function Stepper({ value, onChange, max, step = 1, label }: {
  value: number; onChange: (v: number) => void; max: number; step?: number; label: string;
}) {
  const bump = (dir: 1 | -1) =>
    onChange((((value + dir * step) % (max + 1)) + max + 1) % (max + 1));
  const btn = (dir: 1 | -1, what: string, Icon: typeof PlusIcon) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${what} ${label}`}
      onPress={() => bump(dir)}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.terraFaintBg,
        alignItems: "center", justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon color={colors.terraDeep} size={22} />
    </Pressable>
  );
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      {btn(1, "Increase", PlusIcon)}
      <Text style={{ fontFamily: font.heading, fontSize: 26, color: colors.ink }}>
        {pad2(value)}
      </Text>
      {btn(-1, "Decrease", MinusIcon)}
    </View>
  );
}

export default function MedsScreen() {
  const [meds, setMeds] = useState<Medicine[]>(getState().medicines);
  const [name, setName] = useState("");
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(30);

  useEffect(() => {
    // New day → clear yesterday's "taken" ticks.
    const today = new Date().toDateString();
    const stale = getState().medicines.some(
      (m) => m.takenToday && (!m.lastTaken || new Date(m.lastTaken).toDateString() !== today)
    );
    if (stale) {
      setState((s) => ({
        medicines: s.medicines.map((m) =>
          m.takenToday && (!m.lastTaken || new Date(m.lastTaken).toDateString() !== today)
            ? { ...m, takenToday: false }
            : m
        ),
      }));
    }
    setMeds(getState().medicines);
    return subscribe((s) => setMeds(s.medicines));
  }, []);

  const taken = meds.filter((m) => m.takenToday).length;

  async function addMedicine() {
    const trimmed = name.trim();
    if (!trimmed) {
      speak("Tell me the medicine's name first — you can type it in the box.");
      return;
    }
    await requestAlarmPermission();
    const med: Medicine = { id: uid(), name: trimmed, hour, minute, takenToday: false };
    const notificationId = await scheduleMedicine(med);
    setState((s) => ({
      medicines: [...s.medicines, { ...med, notificationId: notificationId ?? undefined }],
    }));
    logEvent("med_added", trimmed);
    setName("");
    speak(
      `I'll remind you about ${trimmed} every day at ${fmt(hour, minute)}, even when the phone is locked.`
    );
  }

  async function removeMedicine(med: Medicine) {
    await cancelMedicine(med);
    setState((s) => ({ medicines: s.medicines.filter((m) => m.id !== med.id) }));
    logEvent("med_removed", med.name);
    speak(`Okay, I've removed ${med.name}.`);
  }

  function take(med: Medicine) {
    markTaken(med.id);
    speak(`Well done — ${med.name} marked as taken.`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScreenHeader
        title="My medicines"
        onBack={() => router.back()}
        right={
          <IconChip bg={colors.amberSoft}>
            <AlarmIcon color={colors.amber} />
          </IconChip>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: 28, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress card */}
        <View
          style={{
            padding: 18, borderRadius: radius.tile, backgroundColor: colors.amberSoft,
            flexDirection: "row", alignItems: "center", gap: 14,
          }}
        >
          <IconChip bg={colors.card} size={56}>
            <AlarmIcon color={colors.amber} size={30} />
          </IconChip>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontFamily: font.heading, fontSize: 26, color: colors.ink }}>
              {taken} of {meds.length} taken today
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 15, color: colors.amberDeep }}>
              {meds.length === 0
                ? "Add your first medicine below."
                : taken === meds.length
                  ? "All done — lovely."
                  : "I'll remind you when it's time."}
            </Text>
          </View>
        </View>

        {meds.length > 0 ? <SectionLabel>Every day</SectionLabel> : null}

        {/* Medicine rows */}
        {meds.map((med) => (
          <View
            key={med.id}
            style={{
              flexDirection: "row", alignItems: "center", gap: 12,
              paddingVertical: 12, paddingHorizontal: 14,
              borderRadius: 20, backgroundColor: colors.card,
              borderWidth: 1.5, borderColor: colors.cardBorder,
              opacity: med.takenToday ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: font.heading, fontSize: 24, minWidth: 72,
                color: med.takenToday ? colors.muted : colors.ink,
              }}
            >
              {fmt(med.hour, med.minute)}
            </Text>
            <View style={{ flexGrow: 1, flexShrink: 1 }}>
              <Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: colors.ink }}>
                {med.name}
              </Text>
              {med.takenToday && med.lastTaken ? (
                <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.green }}>
                  Taken at{" "}
                  {fmt(new Date(med.lastTaken).getHours(), new Date(med.lastTaken).getMinutes())}
                </Text>
              ) : null}
            </View>
            {med.takenToday ? (
              <IconChip bg={colors.greenSoft} size={44}>
                <CheckIcon color={colors.green} size={22} />
              </IconChip>
            ) : (
              <PillButton
                label="Mark taken"
                kind="green"
                height={44}
                onPress={() => take(med)}
                style={{ paddingHorizontal: 14 }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${med.name}`}
              onPress={() => removeMedicine(med)}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22,
                alignItems: "center", justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <XIcon color={colors.faint} size={20} />
            </Pressable>
          </View>
        ))}

        {/* Add a medicine */}
        <Card style={{ padding: 18, gap: 14 }}>
          <SectionLabel>Add a medicine</SectionLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Medicine name, like Vitamin D"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Medicine name"
            style={{
              height: 54, paddingHorizontal: 16,
              borderRadius: 27, borderWidth: 1.5, borderColor: colors.fieldBorder,
              backgroundColor: colors.bg,
              fontFamily: font.body, fontSize: 17, color: colors.ink,
            }}
          />
          <View
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18,
            }}
          >
            <Stepper value={hour} onChange={setHour} max={23} label="hour" />
            <Text style={{ fontFamily: font.heading, fontSize: 26, color: colors.ink }}>:</Text>
            <Stepper value={minute} onChange={setMinute} max={59} step={5} label="minutes" />
            <View style={{ alignItems: "center", marginLeft: 8 }}>
              <Text style={{ fontFamily: font.heading, fontSize: 26, color: colors.terraDeep }}>
                {fmt(hour, minute)}
              </Text>
              <Text style={type.sub}>every day</Text>
            </View>
          </View>
          <PillButton
            label="Add with alarm"
            kind="primary"
            icon={<PlusIcon color={colors.white} size={22} />}
            onPress={addMedicine}
          />
        </Card>

        <Text style={[type.sub, { textAlign: "center" }]}>
          Or say: "Hey VICA, remind me at 9 pm"
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
