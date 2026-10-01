import React, { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import {
  useFonts,
  Fraunces_500Medium,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from "@expo-google-fonts/atkinson-hyperlegible";
import { colors } from "../theme";
import { loadState, getState } from "../lib/store";
import { initAlarms, attachAlarmResponses } from "../lib/alarms";
import { startMonitoring, onHealthAlert } from "../lib/health";
import { startFallDetection } from "../lib/fall";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: true,
          staysActiveInBackground: false,
        });
      } catch {}
      await loadState();
      await initAlarms();
      setBooted(true);
    })();
  }, []);

  useEffect(() => {
    if (!booted) return;
    const detachAlarms = attachAlarmResponses((medId) =>
      router.push({ pathname: "/alarm", params: { medId } }));
    const offAlert = onHealthAlert((kind, value) =>
      router.push({ pathname: "/pulse-alert", params: { kind, value } }));
    startMonitoring();
    if (getState().profile.conditions.length) {
      startFallDetection(() => router.push("/fall"));
    }
    return () => { detachAlarms(); offAlert(); };
  }, [booted]);

  if (!fontsLoaded || !booted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.terra} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "fade_from_bottom",
        }}
      >
        <Stack.Screen name="fall" options={{ gestureEnabled: false }} />
        <Stack.Screen name="alarm" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
