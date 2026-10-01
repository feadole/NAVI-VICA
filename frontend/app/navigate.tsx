/* Navigate — mockup 07 "Find my way".
   Destination input + quick chips, walking directions that never dead-end,
   and a "Share where I am" safety pill. */
import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, Linking, Platform, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Location from "expo-location";
import { colors, font, radius, space, type } from "../theme";
import { Card, IconChip, PillButton, ScreenHeader } from "../components/ui";
import {
  CompassIcon, HomeIcon, MapIcon, PillIcon, PinIcon, ShareIcon, WalkIcon,
} from "../components/icons";
import { getState, logEvent } from "../lib/store";
import { speak } from "../lib/speech";

const QUICK = [
  { label: "Pharmacy", query: "pharmacy near me", icon: PillIcon },
  { label: "Shop", query: "grocery shop near me", icon: MapIcon },
  { label: "Bus stop", query: "bus stop near me", icon: PinIcon },
  { label: "Park", query: "park near me", icon: CompassIcon },
  { label: "Home", query: "home", icon: HomeIcon },
];

async function getPosition(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return null;
  }
}

export default function NavigateScreen() {
  const [dest, setDest] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = () => dest.trim() || active || "";

  async function walkMeThere() {
    const where = destination();
    if (!where) {
      speak("Tell me where you'd like to go — or pick one of the buttons, like pharmacy or shop.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const q = encodeURIComponent(where);
    try {
      const pos = await getPosition();
      const url = pos
        ? `https://www.google.com/maps/dir/?api=1&origin=${pos.coords.latitude},${pos.coords.longitude}&destination=${q}&travelmode=walking`
        : `https://www.google.com/maps/search/${q}`;
      await Linking.openURL(url);
      speak(
        pos
          ? `Let's go — I've opened your walking route to ${where}.`
          : `I couldn't find your exact spot, but I've opened the map search for ${where}. The map will guide you from here.`
      );
      logEvent("navigate", where);
    } catch {
      // Never dead-end: plain map search always works.
      try { await Linking.openURL(`https://www.google.com/maps/search/${q}`); } catch {}
      speak(`I've opened the map search for ${where}. The map will guide you from here.`);
    } finally {
      setBusy(false);
    }
  }

  async function yandexMaps() {
    const where = destination();
    if (!where) {
      speak("Tell me where you'd like to go first.");
      return;
    }
    const q = encodeURIComponent(where);
    try {
      const pos = await getPosition();
      const url = pos
        ? `https://yandex.com/maps/?rtext=${pos.coords.latitude},${pos.coords.longitude}~${q}&rtt=pd`
        : `https://yandex.com/maps/?text=${q}`;
      await Linking.openURL(url);
      speak(`Let's go — I've opened Yandex Maps for ${where}.`);
    } catch {
      try { await Linking.openURL(`https://yandex.com/maps/?text=${q}`); } catch {}
      speak(`I've opened Yandex Maps for ${where}.`);
    }
  }

  async function shareWhereIAm() {
    const pos = await getPosition();
    const pin = pos
      ? `https://www.google.com/maps/search/?api=1&query=${pos.coords.latitude},${pos.coords.longitude}`
      : null;
    const name = getState().profile.name || "I";
    const message = pin
      ? `${name === "I" ? "I am" : `This is ${name}. I am`} here: ${pin}`
      : `${name === "I" ? "I" : `This is ${name}. I`} need you to check on me — my phone couldn't find my location.`;
    const contact = getState().contacts[0];
    try {
      if (contact?.phone) {
        const sep = Platform.OS === "ios" ? "&" : "?";
        await Linking.openURL(`sms:${contact.phone}${sep}body=${encodeURIComponent(message)}`);
        speak(`I've prepared a message for ${contact.name} with your location. Just press send.`);
      } else {
        await Share.share({ message });
        speak("I've opened sharing so you can send your location to someone you trust.");
      }
      logEvent("location_shared", contact?.name);
    } catch {
      speak("I couldn't open the message just now. Please try again.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Where to?"
        onBack={() => router.back()}
        right={
          <IconChip bg={colors.greenSoft}>
            <CompassIcon color={colors.green} />
          </IconChip>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: 28, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Destination input */}
        <Card style={{ padding: 8 }}>
          <TextInput
            value={dest}
            onChangeText={(t) => { setDest(t); setActive(null); }}
            placeholder="Where would you like to go?"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Where would you like to go?"
            returnKeyType="go"
            onSubmitEditing={walkMeThere}
            style={{
              height: 54,
              paddingHorizontal: 14,
              fontFamily: font.body,
              fontSize: 18,
              color: colors.ink,
            }}
          />
        </Card>

        {/* Quick chips */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {QUICK.map(({ label, query, icon: Icon }) => {
            const selected = active === query;
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setActive(query);
                  setDest("");
                  speak(label);
                }}
                style={({ pressed }) => ({
                  height: 44,
                  paddingHorizontal: 14,
                  borderRadius: 22,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: selected ? colors.greenSoft : colors.card,
                  borderWidth: selected ? 2 : 1.5,
                  borderColor: selected ? colors.green : colors.fieldBorder,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Icon size={18} color={selected ? colors.greenDeep : colors.ink} />
                <Text style={{ fontFamily: font.bodyBold, fontSize: 15, color: colors.ink }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <PillButton
          label={busy ? "Opening the map…" : "Walk me there"}
          kind="primary"
          icon={<WalkIcon color={colors.white} size={22} />}
          onPress={walkMeThere}
        />
        <PillButton
          label="Yandex Maps"
          kind="soft"
          height={54}
          icon={<MapIcon color={colors.ink} size={20} />}
          onPress={yandexMaps}
        />

        {/* Reassurance card — the mockup's step-by-step promise */}
        <View
          style={{
            padding: 16,
            borderRadius: radius.card,
            backgroundColor: colors.green,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <IconChip bg={colors.white} size={56}>
            <WalkIcon color={colors.green} size={30} />
          </IconChip>
          <View style={{ flexShrink: 1 }}>
            <Text
              style={{ fontFamily: font.bodyBold, fontSize: 19, lineHeight: 25, color: colors.white }}
            >
              I'll walk with you, step by step
            </Text>
            <Text
              style={{ fontFamily: font.body, fontSize: 15, lineHeight: 20, color: colors.white, opacity: 0.9 }}
            >
              The map speaks every turn out loud. Take your time — there's no rush.
            </Text>
          </View>
        </View>

        <PillButton
          label="Share where I am"
          kind="red"
          height={54}
          icon={<ShareIcon color={colors.white} size={20} />}
          onPress={shareWhereIAm}
        />
        <Text style={[type.sub, { textAlign: "center" }]}>
          Sends a map pin of your spot to your helper.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
