/* VICA's voice: warm text-to-speech everywhere, speech recognition when
   the platform provides it. Degrades gracefully in Expo Go. */
import * as Speech from "expo-speech";
import { getState } from "./store";

let speaking = false;

export function speak(text: string, opts?: { rate?: number; onDone?: () => void }) {
  if (!text) return;
  stop();
  speaking = true;
  const rate = (opts?.rate ?? getState().profile.voiceRate ?? 1) * 1.02;
  Speech.speak(text, {
    rate,
    pitch: 1.05,
    language: getState().profile.language === "ru" ? "ru-RU" : "en-US",
    onDone: () => { speaking = false; opts?.onDone?.(); },
    onStopped: () => { speaking = false; },
    onError: () => { speaking = false; opts?.onDone?.(); },
  });
}

export function stop() {
  try { Speech.stop(); } catch {}
  speaking = false;
}

export const isSpeaking = () => speaking;

/* Recognition needs a development build (react-native-voice or
   expo-speech-recognition). In Expo Go we report unavailable and screens
   offer the chat keyboard instead — nothing breaks. */
export function recognitionAvailable(): boolean {
  return false; // flips on when the dev-build module is installed
}
