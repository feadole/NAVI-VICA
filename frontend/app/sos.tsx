/* Screen 09 — Emergency ("Get help"). Giant call-112 action, my people
   with one-tap calling, share-my-location, inline add-person. */
import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, Linking, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Location from "expo-location";
import { colors, font, radius, space, type } from "../theme";
import { Card, IconChip, PillButton, SectionLabel } from "../components/ui";
import { PhoneIcon, PinIcon, PlusIcon, CheckIcon, BackIcon } from "../components/icons";
import { getState, setState, subscribe, uid, logEvent, AppState } from "../lib/store";
import { speak } from "../lib/speech";

export default function SosScreen() {
  const [state, setAppState] = useState<AppState>(getState());
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => subscribe(setAppState), []);
  useEffect(() => {
    speak("I'm right here with you.");
  }, []);

  const contacts = state.contacts;

  const call = (phone: string, label: string) => {
    logEvent("call", label);
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const call112 = () => {
    logEvent("sos_call", "112");
    Linking.openURL("tel:112").catch(() => {});
  };

  const shareLocation = async () => {
    try {
      let body = "I need help.";
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        body = `I need help. I am here: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      }
      logEvent("location_shared");
      const first = contacts[0];
      if (first) {
        await Linking.openURL(`sms:${first.phone}?&body=${encodeURIComponent(body)}`);
      } else {
        await Share.share({ message: body });
      }
    } catch {
      speak("I couldn't share your location just now. Please try again.");
    }
  };

  const addPerson = () => {
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name || !phone) return;
    setState((s) => ({ contacts: [...s.contacts, { id: uid(), name, phone }] }));
    logEvent("contact_added", name);
    setNewName("");
    setNewPhone("");
    speak(`${name} is saved. I can call them for you any time.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      {/* header — red tone for emergency */}
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
        <Text style={[type.h3, { color: colors.red }]}>Get help</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.screen, paddingTop: 4, gap: space.gapLg }}
        keyboardShouldPersistTaps="handled">

        {/* giant call-112 pill with soft red halo */}
        <View style={{
          borderRadius: radius.pill + 10, backgroundColor: colors.redSoft, padding: 10,
        }}>
          <PillButton
            label="Call 112" kind="red" height={68}
            icon={<PhoneIcon size={28} color={colors.white} />}
            onPress={call112}
          />
        </View>
        <Text style={[type.sub, { textAlign: "center", fontSize: 16, marginTop: -6 }]}>
          Your location is sent to your family when you call.
        </Text>

        <PillButton
          label="Share where I am" kind="green" height={58}
          icon={<PinIcon size={22} color={colors.white} />}
          onPress={shareLocation}
        />

        <SectionLabel style={{ marginTop: 2 }}>My people</SectionLabel>

        {contacts.length === 0 ? (
          <Text style={type.sub}>No one saved yet — add someone below so VICA can call them for you.</Text>
        ) : null}

        {contacts.map((c) => (
          <View key={c.id} style={{
            flexDirection: "row", alignItems: "center", gap: 14,
            paddingVertical: 12, paddingHorizontal: 14,
            borderRadius: 20, backgroundColor: colors.card,
            borderWidth: 1.5, borderColor: colors.cardBorder,
          }}>
            <IconChip bg={colors.redSoft} size={48}>
              <PhoneIcon size={24} color={colors.red} />
            </IconChip>
            <View style={{ flexGrow: 1, flexShrink: 1 }}>
              <Text style={[type.bodyBold, { fontSize: 18 }]}>{c.name}</Text>
              <Text style={type.sub}>{c.relation ?? c.phone}</Text>
            </View>
            <Pressable
              accessibilityRole="button" accessibilityLabel={`Call ${c.name}`}
              onPress={() => call(c.phone, c.name)}
              style={({ pressed }) => [{
                width: 52, height: 52, borderRadius: 26, backgroundColor: colors.green,
                alignItems: "center", justifyContent: "center",
              }, pressed && { opacity: 0.85 }]}>
              <PhoneIcon size={24} color={colors.white} />
            </Pressable>
          </View>
        ))}

        {/* inline add-person */}
        <Card style={{ padding: 14, gap: 10 }}>
          <Text style={type.bodyBold}>Add a person</Text>
          <TextInput
            value={newName} onChangeText={setNewName}
            placeholder="Name" placeholderTextColor={colors.faint}
            accessibilityLabel="Name"
            style={inputStyle}
          />
          <TextInput
            value={newPhone} onChangeText={setNewPhone}
            placeholder="Phone number" placeholderTextColor={colors.faint}
            keyboardType="phone-pad" accessibilityLabel="Phone number"
            style={inputStyle}
          />
          <PillButton
            label="Add to my people" kind="outline" height={52}
            icon={<PlusIcon size={20} color={colors.terraDeep} />}
            onPress={addPerson}
          />
        </Card>

        {/* fall-detection reassurance banner from the mockup */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          paddingVertical: 12, paddingHorizontal: 16,
          borderRadius: radius.chip, backgroundColor: colors.greenSoft,
        }}>
          <CheckIcon size={22} color={colors.greenDeep} />
          <Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: colors.greenDeep }}>
            Fall detection is on
          </Text>
        </View>
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
