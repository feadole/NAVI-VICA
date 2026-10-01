/* Detect — mockup 06 "What's around me".
   Camera preview, VICA's spoken scene description, torch, safety warnings. */
import React, { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, font, radius, space, type } from "../theme";
import { Card, IconChip, PillButton, ScreenHeader } from "../components/ui";
import { CameraIcon, EyeIcon, SpeakerIcon, SunIcon } from "../components/icons";
import { getState, logEvent } from "../lib/store";
import { speak } from "../lib/speech";
import { analyzeScene, backendConfigured } from "../lib/api";

const NO_BRAIN =
  "I need my brain server for this — ask your helper to set EXPO_PUBLIC_BACKEND_URL. " +
  "I can still guide you and mind your medicines.";

export default function DetectScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(
    "Point the camera ahead and I'll tell you what I see."
  );
  const [warnings, setWarnings] = useState<string[]>([]);

  async function describe() {
    if (busy) return;
    setBusy(true);
    setWarnings([]);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.5,
      });
      if (!photo?.base64) {
        const msg = "I couldn't take a picture just now. Let's try once more.";
        setResult(msg);
        speak(msg);
        return;
      }
      if (!backendConfigured()) {
        setResult(NO_BRAIN);
        speak(NO_BRAIN);
        return;
      }
      const profile = getState().profile.conditions[0] ?? "general";
      const scene = await analyzeScene(photo.base64, profile);
      if (!scene) {
        const msg =
          "I couldn't reach my brain server just now. Please try again in a moment.";
        setResult(msg);
        speak(msg);
        return;
      }
      const names = scene.detections.map((d) => d.class_name);
      const listed = names.length
        ? ` I can see: ${names.slice(0, 6).join(", ")}.`
        : "";
      const text = `${scene.ai_description}${listed}`;
      setResult(text);
      setWarnings(scene.safety_warnings ?? []);
      const warnText = (scene.safety_warnings ?? []).join(". ");
      speak(warnText ? `${text} Careful: ${warnText}` : text);
      logEvent("scene_described", names.join(","));
    } catch {
      const msg = "Something went wrong with the camera. Let's try again.";
      setResult(msg);
      speak(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScreenHeader
        title="What's around me"
        onBack={() => router.back()}
        right={
          <IconChip bg={colors.terraSoft}>
            <EyeIcon color={colors.terraDeep} />
          </IconChip>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: 28,
          gap: 14,
        }}
      >
        {/* Camera preview, rounded 24, roughly 4:3 */}
        <View
          style={{
            borderRadius: radius.tile,
            overflow: "hidden",
            backgroundColor: "#3A2C24",
            aspectRatio: 4 / 3.3, // ~4:3, like the mockup's 290px-tall preview
          }}
        >
          {permission?.granted ? (
            <>
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                facing="back"
                enableTorch={torch}
              />
              {/* Live badge */}
              <View
                style={{
                  position: "absolute",
                  left: 14,
                  top: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: "rgba(59,42,32,0.75)",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#E0623E",
                  }}
                />
                <Text
                  style={{ fontFamily: font.bodyBold, fontSize: 13, color: colors.white }}
                >
                  Live
                </Text>
              </View>
              {/* Torch toggle */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
                onPress={() => setTorch((t) => !t)}
                style={({ pressed }) => ({
                  position: "absolute",
                  right: 14,
                  top: 14,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: torch ? colors.amberSoft : "rgba(255,253,249,0.9)",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <SunIcon color={torch ? colors.amberDeep : colors.ink} />
              </Pressable>
            </>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                gap: 12,
              }}
            >
              <IconChip bg={colors.terraSoft} size={56}>
                <CameraIcon color={colors.terraDeep} size={28} />
              </IconChip>
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 17,
                  lineHeight: 24,
                  color: colors.white,
                  textAlign: "center",
                }}
              >
                I need the camera to see what's around you. Nothing is saved — I only
                look when you ask.
              </Text>
              <PillButton
                label="Let VICA use the camera"
                kind="primary"
                height={52}
                onPress={() => requestPermission()}
              />
            </View>
          )}
        </View>

        {/* VICA's description */}
        <Card style={{ padding: 18, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <SpeakerIcon color={colors.terraDeep} size={20} />
            <Text
              style={{ fontFamily: font.bodyBold, fontSize: 15, color: colors.terraDeep }}
            >
              VICA says
            </Text>
            {busy ? <ActivityIndicator color={colors.terra} size="small" /> : null}
          </View>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: font.body,
              fontSize: 19,
              lineHeight: 27,
              color: colors.ink,
            }}
          >
            {result}
          </Text>
        </Card>

        {/* Safety warnings */}
        {warnings.length > 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: radius.card,
              backgroundColor: colors.redSoft,
              gap: 6,
            }}
          >
            <Text style={{ fontFamily: font.bodyBold, fontSize: 15, color: colors.red }}>
              Careful
            </Text>
            {warnings.map((w, i) => (
              <Text
                key={i}
                style={{
                  fontFamily: font.bodyBold,
                  fontSize: 17,
                  lineHeight: 23,
                  color: colors.red,
                }}
              >
                {w}
              </Text>
            ))}
          </View>
        ) : null}

        <PillButton
          label={busy ? "Looking…" : "Describe what's around"}
          kind="primary"
          icon={<CameraIcon color={colors.white} size={22} />}
          onPress={describe}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
