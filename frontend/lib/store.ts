/* Tiny persistent store: one JSON document in AsyncStorage, a change
   feed for screens, and typed slices for everything the app remembers. */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Contact = { id: string; name: string; phone: string; relation?: string };
export type Medicine = {
  id: string; name: string; hour: number; minute: number;
  takenToday?: boolean; lastTaken?: number; notificationId?: string;
};
export type Vitals = { pulse: number | null; sys: number | null; dia: number | null; at: number | null; source: "bracelet" | "manual" | null };
export type Profile = {
  name: string; conditions: string[]; language: string;
  textScale: number; voiceRate: number; setupDone: boolean;
  permissions: Record<string, boolean>;
  braceletName?: string | null;
};

export type AppState = {
  profile: Profile;
  medicines: Medicine[];
  contacts: Contact[];
  vitals: Vitals;
  vitalsLog: { at: number; pulse?: number; sys?: number; dia?: number }[];
  events: { at: number; kind: string; detail?: string }[];
};

const KEY = "navi-vica-state-v1";

export const defaultState: AppState = {
  profile: {
    name: "", conditions: [], language: "en",
    textScale: 1, voiceRate: 1, setupDone: false, permissions: {},
    braceletName: null,
  },
  medicines: [],
  contacts: [],
  vitals: { pulse: null, sys: null, dia: null, at: null, source: null },
  vitalsLog: [],
  events: [],
};

let state: AppState = structuredClone(defaultState);
let loaded = false;
const listeners = new Set<(s: AppState) => void>();

export async function loadState(): Promise<AppState> {
  if (loaded) return state;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch {}
  loaded = true;
  return state;
}

export function getState(): AppState { return state; }

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l(state));
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export function subscribe(fn: (s: AppState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function logEvent(kind: string, detail?: string) {
  setState((s) => ({ events: [...s.events.slice(-199), { at: Date.now(), kind, detail }] }));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
