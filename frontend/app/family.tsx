/* Screen M6 — Family view, for carers. One calm page: who you look after,
   pulse and BP, medicines, location, falls — and a call button. */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { colors, font, space, type } from "../theme";
import { PillButton, Row, SectionLabel, StatusChip } from "../components/ui";
import { HeartPulseIcon, AlarmIcon, PinIcon, BellIcon, PhoneIcon } from "../components/icons";
import { getState, subscribe, AppState } from "../lib/store";
import { LIMITS } from "../lib/health";

const pad = (n: number) => String(n).padStart(2, "0");

export default function FamilyScreen() {
  const [state, setAppState] = useState<AppState>(getState());
  useEffect(() => subscribe(setAppState), []);

  const { profile, vitals, medicines, contacts, events } = state;
  const name = profile.name || "Your person";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  /* vitals */
  const vitalsBad =
    (vitals.pulse != null && (vitals.pulse >= LIMITS.pulseHigh || vitals.pulse <= LIMITS.pulseLow)) ||
    (vitals.sys != null && vitals.sys >= LIMITS.sysHigh) ||
    (vitals.dia != null && vitals.dia >= LIMITS.diaHigh);
  const vitalsTitle = vitals.pulse != null || vitals.sys != null
    ? `Pulse ${vitals.pulse ?? "—"} · BP ${vitals.sys ?? "—"}/${vitals.dia ?? "—"}`
    : "No readings yet";

  /* medicines */
  const now = new Date();
  const taken = medicines.filter((m) => m.takenToday).length;
  const missed = medicines.filter((m) =>
    !m.takenToday &&
    (m.hour < now.getHours() || (m.hour === now.getHours() && m.minute <= now.getMinutes()))
  );
  const medsTitle = medicines.length
    ? `Medicines ${taken} of ${medicines.length} taken`
    : "No medicines set up";
  const medsSub = missed.length
    ? `${missed[0].name} was missed at ${pad(missed[0].hour)}:${pad(missed[0].minute)}`
    : "All on schedule";

  /* falls in the last 7 days */
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const falls = events.filter((e) => e.kind === "fall_suspected" && e.at >= weekAgo).length;

  const allWell = !vitalsBad && missed.length === 0 && falls === 0;
  const updatedMins = vitals.at ? Math.max(0, Math.round((Date.now() - vitals.at) / 60000)) : null;
  const statusLine = `${allWell ? "All well" : "Worth a look"} · ${
    updatedMins == null ? "waiting for a reading"
      : updatedMins < 1 ? "updated just now"
      : `updated ${updatedMins} min ago`
  }`;

  const firstContact = contacts[0];

  const seeOnMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({});
      await Linking.openURL(`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: space.screen, gap: space.gapSm }}>
        {/* header */}
        <SectionLabel>You are looking after</SectionLabel>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28, backgroundColor: colors.terraSoft,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontFamily: font.heading, fontSize: 24, color: colors.terraDeep }}>
              {initial}
            </Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontFamily: font.heading, fontSize: 26, lineHeight: 31, color: colors.ink }}>
              {name}
            </Text>
            <Text style={{
              fontFamily: font.bodyBold, fontSize: 15,
              color: allWell ? colors.green : colors.amber,
            }}>
              {statusLine}
            </Text>
          </View>
        </View>

        {/* four status rows */}
        <Row
          icon={<HeartPulseIcon size={22} color={colors.red} />}
          iconBg={colors.redSoft}
          title={vitalsTitle}
          subtitle={vitals.source === "bracelet" ? "From the bracelet" : "Entered by hand"}
          right={<StatusChip label={vitalsBad ? "Check" : "OK"} tone={vitalsBad ? "warn" : "ok"} />}
        />
        <Row
          icon={<AlarmIcon size={22} color={colors.amber} />}
          iconBg={colors.amberSoft}
          title={medsTitle}
          subtitle={medsSub}
          right={<StatusChip label={missed.length ? "Check" : "OK"} tone={missed.length ? "warn" : "ok"} />}
        />
        <Row
          icon={<PinIcon size={22} color={colors.green} />}
          iconBg={colors.greenSoft}
          title="At home"
          subtitle="Inside the safe zone"
          right={<StatusChip label="OK" tone="ok" />}
        />
        <Row
          icon={<BellIcon size={22} color={colors.purple} />}
          iconBg={colors.purpleSoft}
          title={falls ? `${falls} fall${falls > 1 ? "s" : ""} this week` : "No falls this week"}
          subtitle="Fall detection is on"
          right={<StatusChip label={falls ? "Check" : "OK"} tone={falls ? "warn" : "ok"} />}
        />
      </ScrollView>

      {/* pinned bottom actions */}
      <View style={{
        flexDirection: "row", gap: 10,
        paddingHorizontal: space.screen, paddingBottom: 14, paddingTop: 6,
      }}>
        <PillButton
          label={`Call ${profile.name || "them"}`} kind="green" height={58}
          icon={<PhoneIcon size={22} color={colors.white} />}
          style={[{ flex: 1 }, !firstContact && { opacity: 0.45 }]}
          onPress={firstContact
            ? () => Linking.openURL(`tel:${firstContact.phone}`).catch(() => {})
            : undefined}
        />
        <PillButton
          label="See on map" kind="soft" height={58}
          style={{ flex: 1 }}
          onPress={seeOnMap}
        />
      </View>
    </SafeAreaView>
  );
}
