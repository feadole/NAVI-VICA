/* Chat — mockup 04. Typed conversation with VICA: her bubbles on the
   left in cream cards, yours on the right in terracotta-soft. Every
   message goes through the brain; a header speaker toggle mutes her. */
import React, { useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, font, space, type } from "../theme";
import { BackIcon, MicIcon, SendIcon, SpeakerIcon } from "../components/icons";
import { getState } from "../lib/store";
import { stop } from "../lib/speech";
import { handleUtterance } from "../lib/brain";

type Msg = { id: number; who: "me" | "vica"; text: string };

const SUGGESTIONS = ["What's around me?", "Call my family", "Remind me my medicine", "How are you?"];

export default function ChatScreen() {
  const name = getState().profile.name || "dear";
  const [messages, setMessages] = useState<Msg[]>([{
    id: 0,
    who: "vica",
    text: `Hello ${name}! Ask me anything — or ask me to look around, guide you, or mind your medicines.`,
  }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  const nextId = useRef(1);

  const firstOpen = !messages.some((m) => m.who === "me");

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    voiceOnRef.current = next;
    if (!next) stop();
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setDraft("");
    setMessages((m) => [...m, { id: nextId.current++, who: "me", text }]);
    setBusy(true);
    try {
      const reply = await handleUtterance(text); // brain speaks her reply
      if (!voiceOnRef.current) stop();            // muted: silence it right away
      setMessages((m) => [...m, { id: nextId.current++, who: "vica", text: reply.text }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* header — back chip, V avatar, name, speaker toggle */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button" accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headChip, pressed && { opacity: 0.8 }]}
        >
          <BackIcon size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>V</Text>
        </View>
        <View style={{ flexGrow: 1 }}>
          <Text style={styles.headTitle}>VICA</Text>
          <Text style={styles.headSub}>Here for you</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceOn ? "Mute VICA's voice" : "Unmute VICA's voice"}
          accessibilityState={{ selected: voiceOn }}
          onPress={toggleVoice}
          style={({ pressed }) => [
            styles.headChip,
            voiceOn && { backgroundColor: colors.greenSoft },
            pressed && { opacity: 0.8 },
          ]}
        >
          <SpeakerIcon size={22} color={voiceOn ? colors.greenDeep : colors.faint} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.dayLabel}>Today</Text>
          {messages.map((m) =>
            m.who === "me" ? (
              <View key={m.id} style={styles.meBubble}>
                <Text style={styles.meText}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={styles.vicaBubble}>
                <Text style={styles.vicaText}>{m.text}</Text>
              </View>
            )
          )}
          {busy ? <Text style={[type.sub, { alignSelf: "flex-start" }]}>VICA is thinking…</Text> : null}

          {firstOpen ? (
            <View style={styles.chipWrap}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Send: ${s}`}
                  onPress={() => send(s)}
                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* input bar pinned at the bottom */}
        <View style={styles.inputBar}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
            placeholder="Type a message…"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Message to VICA"
            returnKeyType="send"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button" accessibilityLabel="Speak instead"
            onPress={() => router.push("/listen" as never)}
            style={({ pressed }) => [styles.micButton, pressed && { opacity: 0.8 }]}
          >
            <MicIcon size={24} color={colors.terraDeep} />
          </Pressable>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Send message"
            onPress={() => send(draft)}
            style={({ pressed }) => [styles.sendButton, pressed && { opacity: 0.85 }]}
          >
            <SendIcon size={24} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: space.screen, paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1.5, borderBottomColor: colors.cardBorder,
  },
  headChip: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terraFaintBg,
    alignItems: "center", justifyContent: "center",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terra,
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { fontFamily: font.heading, fontSize: 20, color: colors.white },
  headTitle: { fontFamily: font.heading, fontSize: 22, color: colors.ink },
  headSub: { fontFamily: font.bodyBold, fontSize: 14, color: colors.green },

  messages: { paddingHorizontal: space.screen, paddingVertical: 18, gap: space.gap },
  dayLabel: { alignSelf: "center", fontFamily: font.body, fontSize: 14, color: colors.muted },

  meBubble: {
    alignSelf: "flex-end", maxWidth: "78%", paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.terraSoft,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 6,
  },
  meText: { fontFamily: font.body, fontSize: 17, lineHeight: 24, color: colors.ink },
  vicaBubble: {
    alignSelf: "flex-start", maxWidth: "84%", paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 18,
  },
  vicaText: { fontFamily: font.body, fontSize: 17, lineHeight: 24, color: colors.ink },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    height: 44, paddingHorizontal: 16, borderRadius: 22,
    backgroundColor: colors.terraFaintBg, borderWidth: 1.5, borderColor: colors.fieldBorder,
    alignItems: "center", justifyContent: "center",
  },
  chipText: { fontFamily: font.bodyBold, fontSize: 16, color: colors.ink },

  inputBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    backgroundColor: colors.card, borderTopWidth: 1.5, borderTopColor: colors.cardBorder,
  },
  input: {
    flexGrow: 1, flexShrink: 1, minWidth: 0, height: 54, paddingHorizontal: 18,
    borderRadius: 27, backgroundColor: colors.bg,
    borderWidth: 1.5, borderColor: colors.fieldBorder,
    fontFamily: font.body, fontSize: 18, color: colors.ink,
  },
  micButton: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: colors.terraSoft,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sendButton: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: colors.terra,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
});
