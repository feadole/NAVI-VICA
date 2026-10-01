/* Screen M5 — Fall detected. Full-bleed red, a 30-second countdown ring,
   vibration and spoken warnings, then a call to 112 with location shared. */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Linking, Vibration } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Location from "expo-location";
import { colors, font } from "../theme";
import { PillButton } from "../components/ui";
import { getState, logEvent } from "../lib/store";
import { speak, stop } from "../lib/speech";

export default function FallScreen() {
  const [secs, setSecs] = useState(30);
  const doneRef = useRef(false);

  useEffect(() => {
    Vibration.vibrate([0, 600, 400], true);
    speak("It looks like you fell. Are you okay? I will call for help in 30 seconds.");
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => { clearInterval(t); Vibration.cancel(); stop(); };
  }, []);

  useEffect(() => {
    if (doneRef.current) return;
    if (secs === 20 || secs === 10 || secs === 5) speak(`${secs} seconds`);
    if (secs === 0) callForHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs]);

  const callForHelp = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Vibration.cancel();
    logEvent("auto_call", "112 after fall");
    Linking.openURL("tel:112").catch(() => {});
    /* best effort: text the first contact where we are */
    try {
      const first = getState().contacts[0];
      if (first) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          const body = `I may have fallen. I am here: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
          await Linking.openURL(`sms:${first.phone}?&body=${encodeURIComponent(body)}`);
        }
      }
    } catch {}
  };

  const imOkay = () => {
    doneRef.current = true;
    Vibration.cancel();
    logEvent("fall_ok");
    speak("Thank goodness. Take your time getting up.");
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.red }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{
          marginTop: 56, fontFamily: font.bodyBold, fontSize: 18,
          color: colors.white, opacity: 0.9,
        }}>
          It looks like you fell
        </Text>

        {/* countdown ring */}
        <View style={{
          marginTop: 26, width: 210, height: 210, borderRadius: 105,
          borderWidth: 10, borderColor: "rgba(255,255,255,0.25)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{
            fontFamily: font.heading, fontSize: 84, lineHeight: 90, color: colors.white,
          }}>
            {secs}
          </Text>
          <Text style={{
            fontFamily: font.body, fontSize: 16, color: colors.white, opacity: 0.9,
          }}>
            seconds
          </Text>
        </View>

        <Text style={{
          marginTop: 26, fontFamily: font.heading, fontSize: 30, lineHeight: 36,
          color: colors.white, textAlign: "center",
        }}>
          Calling 112 soon
        </Text>
        <Text style={{
          marginTop: 8, fontFamily: font.body, fontSize: 18, lineHeight: 25,
          color: colors.white, opacity: 0.92, textAlign: "center",
        }}>
          Your location will be sent to your family. Say "I'm okay" to stop.
        </Text>

        {/* buttons pinned to the bottom */}
        <View style={{ position: "absolute", left: 24, right: 24, bottom: 24, gap: 12 }}>
          <PillButton
            label="I'm okay" kind="soft" height={68}
            style={{ backgroundColor: colors.white, borderWidth: 0 }}
            onPress={imOkay}
          />
          <PillButton
            label="Call for help now" kind="lockGhost" height={58}
            onPress={() => {
              doneRef.current = true;
              Vibration.cancel();
              logEvent("sos_call", "112 after fall");
              Linking.openURL("tel:112").catch(() => {});
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
