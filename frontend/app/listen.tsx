/* Talking to VICA — mockup 03. The big green listening state, plus an
   honest fallback: in Expo Go speech recognition is unavailable, so VICA
   says so once and offers a large type-to-talk box instead. */
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, space, type } from "../theme";
import { ScreenHeader, PillButton } from "../components/ui";
import { MicIcon, SendIcon } from "../components/icons";
import { speak, recognitionAvailable } from "../lib/speech";
import { handleUtterance } from "../lib/brain";

type Turn = { id: number; who: "me" | "vica"; text: string };

const SUGGESTIONS = [
  "What's around me?",
  "Take me to the pharmacy",
  "Remind me my medicine",
  "How are you?",
];

export default function ListenScreen() {
  const canHear = recognitionAvailable();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!canHear) {
      /* Honest and useful: say it once, then let them type. */
      speak("My ears need the full app — but you can type to me and I'll talk back.");
    }
  }, [canHear]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setDraft("");
    setTurns((t) => [...t, { id: nextId.current++, who: "me", text }]);
    setBusy(true);
    try {
      const reply = await handleUtterance(text); // VICA speaks via brain
      setTurns((t) => [...t, { id: nextId.current++, who: "vica", text: reply.text }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScreenHeader title="Talking to VICA" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollBody}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {/* big green listening state */}
          <View style={styles.micBlock}>
            <View style={styles.haloOuter}>
              <View style={styles.haloInner}>
                <View
                  accessibilityLabel={canHear ? "Listening" : "Waiting — type below"}
                  style={[styles.micCircle, !canHear && styles.micCircleWaiting]}
                >
                  <MicIcon size={54} color={canHear ? colors.white : colors.green} />
                </View>
              </View>
            </View>
            <Text style={styles.statusTitle}>
              {canHear ? "I'm listening…" : "My ears are waiting"}
            </Text>
            <Text style={styles.statusSub}>
              {canHear
                ? "Take your time. No need to say “Hey VICA” again."
                : "Voice needs the full app — type below and I'll talk back."}
            </Text>
          </View>

          {/* live conversation */}
          {turns.length === 0 ? (
            <View style={styles.hintCard}>
              <Text style={styles.hintText}>
                Try: {"“"}What's around me?{"”"}
              </Text>
            </View>
          ) : (
            <View style={{ gap: space.gap }}>
              {turns.map((t) =>
                t.who === "me" ? (
                  <View key={t.id} style={styles.meBubble}>
                    <Text style={styles.meText}>{t.text}</Text>
                  </View>
                ) : (
                  <View key={t.id} style={styles.vicaBubble}>
                    <Text style={styles.vicaText}>{t.text}</Text>
                  </View>
                )
              )}
              {busy ? <Text style={[type.sub, { alignSelf: "flex-start" }]}>VICA is thinking…</Text> : null}
            </View>
          )}
        </ScrollView>

        {/* quick suggestions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Say: ${s}`}
              onPress={() => send(s)}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* type to VICA */}
        <View style={styles.inputArea}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
            placeholder="Type to VICA…"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Type your message to VICA"
            returnKeyType="send"
            style={styles.input}
            multiline={false}
          />
          <PillButton
            label={busy ? "One moment…" : "Tell VICA"}
            kind="primary"
            icon={<SendIcon size={20} color={colors.white} />}
            onPress={() => send(draft)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollBody: { paddingHorizontal: space.screen, paddingBottom: 12 },

  micBlock: { alignItems: "center", gap: 10, paddingVertical: 14 },
  haloOuter: {
    width: 236, height: 236, borderRadius: 118, backgroundColor: "#EEF2E6",
    alignItems: "center", justifyContent: "center",
  },
  haloInner: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: colors.greenSoft,
    alignItems: "center", justifyContent: "center",
  },
  micCircle: {
    width: 128, height: 128, borderRadius: 64, backgroundColor: colors.green,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.green, shadowOpacity: 0.32, shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 }, elevation: 8,
  },
  micCircleWaiting: {
    backgroundColor: colors.card, borderWidth: 2.5, borderColor: colors.green,
    shadowOpacity: 0.14, elevation: 2,
  },
  statusTitle: { fontFamily: font.heading, fontSize: 28, color: colors.ink, textAlign: "center" },
  statusSub: {
    fontFamily: font.body, fontSize: 17, lineHeight: 23, color: colors.muted,
    textAlign: "center", paddingHorizontal: 8,
  },

  hintCard: {
    padding: 16, borderRadius: 20, backgroundColor: colors.card,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C9B49C",
  },
  hintText: {
    fontFamily: font.body, fontSize: 20, lineHeight: 28,
    color: colors.muted, textAlign: "center",
  },

  meBubble: {
    alignSelf: "flex-end", maxWidth: "78%", paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.terra,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderBottomLeftRadius: 22, borderBottomRightRadius: 6,
  },
  meText: { fontFamily: font.body, fontSize: 18, lineHeight: 25, color: colors.white },
  vicaBubble: {
    alignSelf: "flex-start", maxWidth: "84%", paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 22,
  },
  vicaText: { fontFamily: font.body, fontSize: 18, lineHeight: 25, color: colors.ink },

  chipRow: { gap: 8, paddingHorizontal: space.screen, paddingVertical: 8 },
  chip: {
    height: 44, paddingHorizontal: 16, borderRadius: 22,
    backgroundColor: colors.terraFaintBg, borderWidth: 1.5, borderColor: colors.fieldBorder,
    alignItems: "center", justifyContent: "center",
  },
  chipText: { fontFamily: font.bodyBold, fontSize: 16, color: colors.ink },

  inputArea: {
    paddingHorizontal: space.screen, paddingTop: 4, paddingBottom: 10, gap: 10,
  },
  input: {
    minHeight: 58, paddingHorizontal: 18, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.fieldBorder,
    fontFamily: font.body, fontSize: 18, color: colors.ink,
  },
});
