/* VICA's on-device brain: every typed or spoken sentence lands here and
   can reach every part of the app. When nothing matches, the Gemini
   backend answers (if configured) — otherwise she answers honestly. */
import { router } from "expo-router";
import { Linking } from "react-native";
import { askVica } from "./api";
import { speak } from "./speech";
import { getState, logEvent } from "./store";
import { markTaken } from "./alarms";

export type BrainReply = { text: string };

const R = (a: string[]) => a[Math.floor(Math.random() * a.length)];

const OPEN: [RegExp, string, string][] = [
  [/(what('| i)s around|look around|describe|detect|see for me|around me)/, "/detect", "Opening my eyes. Point the camera ahead of you."],
  [/(navigate|take me|walk me|directions|guide me|find a|nearest|where is)/, "/navigate", "Let's find the way together."],
  [/(medicine|medicines|pills|tablets|alarm|reminder|meds)/, "/meds", "Here are your medicines."],
  [/(emergency|help me|call for help|sos)/, "/sos", "Opening emergency. Stay calm, I'm here."],
  [/(health|pulse|blood pressure|heart|vitals)/, "/health", "Here is your health."],
  [/(setting|voice|text size|language)/, "/settings", "Here are your settings."],
  [/(chat|type|keyboard)/, "/chat", "You can type to me here."],
  [/(home screen|go home$|main screen)/, "/home", "Going home."],
  [/(family|carer|caretaker|looking after)/, "/family", "Here is the family view."],
  [/(bracelet|pair|connect.*(watch|band|cuff))/, "/pair", "Let's connect your bracelet."],
];

export async function handleUtterance(raw: string): Promise<BrainReply> {
  const c = raw.toLowerCase().trim();
  const s = getState();
  const name = s.profile.name || "dear";

  const done = (text: string, say = true): BrainReply => {
    if (say) speak(text);
    return { text };
  };

  /* ---- actions ---- */
  if (/(i took (it|my)|taken|i had my (pill|medicine))/.test(c)) {
    const due = s.medicines.find((m) => !m.takenToday);
    if (due) { markTaken(due.id); return done(`Well done — I've marked ${due.name} as taken.`); }
    return done("Lovely — everything is already marked as taken today.");
  }
  if (/(call|ring|phone)\s+(my\s+)?(family|daughter|son|wife|husband|carer)/.test(c) || /call my people/.test(c)) {
    const p = s.contacts[0];
    if (p) { logEvent("call", p.name); Linking.openURL(`tel:${p.phone}`); return done(`Calling ${p.name} now.`); }
    router.push("/sos"); return done("You haven't added your people yet — let's do that here.");
  }
  if (/(ambulance|112|911|emergency number)/.test(c)) {
    Linking.openURL("tel:112"); return done("Calling emergency services now. Stay with me.");
  }

  /* ---- open any screen ---- */
  for (const [rx, path, reply] of OPEN) {
    if (rx.test(c)) { router.push(path as never); return done(reply); }
  }

  /* ---- small talk ---- */
  if (/(^|\s)(hello|hi|hey|good (morning|afternoon|evening))/.test(c))
    return done(R([
      `Hello, ${name}! I'm right here. Shall I look around for you, guide you somewhere, or check your health?`,
      `Hey, so good to hear you. What shall we do — go for a walk, check your medicines, or just talk?`,
    ]));
  if (/how are you/.test(c))
    return done(`I'm wonderful, thank you — and I'm here for you, ${name}. What would you like to do?`);
  if (/(thank|thanks)/.test(c)) return done(R(["Always, dear.", "It's my pleasure — truly."]));
  if (/\btime\b/.test(c)) return done(`It's ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
  if (/(what day|date|today)/.test(c)) return done(`Today is ${new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}.`);

  /* ---- Gemini backend, then honest fallback ---- */
  const ai = await askVica(raw, `User name: ${name}`);
  if (ai?.response_text) return done(ai.response_text);
  if (/(can you|could you|please|turn (on|off)|open the|send|pay|buy)/.test(c))
    return done("That one I can't do, dear — some things are locked away from me for your safety. But I can look around, guide you, mind your medicines and health, call your people, or just keep you company.");
  return done(R([
    "I hear you! Tell me more — or ask me to look around, guide you somewhere, or check your health.",
    "I'm listening, dear. I can see for you, walk with you, mind your medicines, or call your family — just say the word.",
  ]));
}
