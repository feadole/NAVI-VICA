/* Screen M2 — Connect bracelet. Pulsing purple circles, a simulated
   nearby-device scan (real BLE arrives with the dev build), one-tap connect. */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, radius, space, type } from "../theme";
import { PillButton, Row, ScreenHeader, SectionLabel, StatusChip } from "../components/ui";
import { BraceletIcon, GaugeIcon } from "../components/icons";
import { getState } from "../lib/store";
import { speak } from "../lib/speech";
import { bleAvailable, braceletConnected, connectBracelet } from "../lib/health";

const DEVICES = [
  { name: "VICA Pulse Band", sub: "Pulse sensor · very close", primary: true },
  { name: "BP-200 Cuff", sub: "Blood pressure · nearby", primary: false },
];

export default function PairScreen() {
  const [found, setFound] = useState(false);
  const [connected, setConnected] = useState<string | null>(
    braceletConnected() ? getState().profile.braceletName ?? null : null
  );
  const pulse = useRef(new Animated.Value(0)).current;

  /* gentle breathing animation on the circles */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  /* bleAvailable() is false in Expo Go — simulate a short scan instead */
  useEffect(() => {
    if (bleAvailable()) return; // real scan would start here in the dev build
    const t = setTimeout(() => setFound(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  const doConnect = (name: string) => {
    connectBracelet(name);
    setConnected(name);
    speak("Connected! I'll keep an eye on your pulse from now on.");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScreenHeader title="Connect bracelet" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{
        padding: space.screen, paddingTop: 10, alignItems: "center", gap: 18,
      }}>
        {/* concentric purple circles with the bracelet at the center */}
        <Animated.View style={{
          width: 220, height: 220, borderRadius: 110, backgroundColor: colors.purpleFaint,
          alignItems: "center", justifyContent: "center", transform: [{ scale }],
        }}>
          <View style={{
            width: 160, height: 160, borderRadius: 80, backgroundColor: colors.purpleSoft,
            alignItems: "center", justifyContent: "center",
          }}>
            <View style={{
              width: 104, height: 104, borderRadius: 52, backgroundColor: colors.purple,
              alignItems: "center", justifyContent: "center",
            }}>
              <BraceletIcon size={50} color={colors.white} />
            </View>
          </View>
        </Animated.View>

        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: font.heading, fontSize: 24, lineHeight: 29, color: colors.ink }}>
            {connected ? "All set!" : "Looking for your bracelet"}
          </Text>
          <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>
            {connected
              ? "VICA is reading your pulse now."
              : "Hold it close to the phone and press its button."}
          </Text>
        </View>

        <View style={{ width: "100%", gap: space.gapSm }}>
          <SectionLabel>Found nearby</SectionLabel>

          {!found && !connected ? (
            <Text style={type.sub}>Listening for devices…</Text>
          ) : null}

          {(found || connected) && DEVICES.map((d) => (
            <Row
              key={d.name}
              selected={d.primary && connected !== d.name}
              icon={d.primary
                ? <BraceletIcon size={22} color={colors.purple} />
                : <GaugeIcon size={22} color={colors.ink} />}
              iconBg={d.primary ? colors.purpleSoft : colors.terraFaintBg}
              title={d.name}
              subtitle={d.sub}
              right={connected === d.name ? (
                <StatusChip label="Connected" tone="ok" />
              ) : (
                <Pressable
                  accessibilityRole="button" accessibilityLabel={`Connect ${d.name}`}
                  onPress={() => doConnect(d.name)}
                  style={({ pressed }) => [{
                    height: 44, paddingHorizontal: 16, borderRadius: 22,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: d.primary ? colors.purple : colors.bg,
                    borderWidth: d.primary ? 0 : 1.5,
                    borderColor: colors.fieldBorder,
                  }, pressed && { opacity: 0.85 }]}>
                  <Text style={{
                    fontFamily: font.bodyBold, fontSize: 16,
                    color: d.primary ? colors.white : colors.ink,
                  }}>
                    Connect
                  </Text>
                </Pressable>
              )}
            />
          ))}
        </View>

        {connected ? (
          <PillButton label="Done" kind="green" height={58}
            style={{ alignSelf: "stretch" }}
            onPress={() => router.back()} />
        ) : null}

        <Text style={[type.sub, { textAlign: "center", color: colors.faint }]}>
          Real Bluetooth pairing arrives with the full app build — for now VICA simulates
          your bracelet so everything works.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
