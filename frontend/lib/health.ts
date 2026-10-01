/* Health module: vitals, thresholds, and the pulse bracelet.
   Real Bluetooth (react-native-ble-plx) needs a development build; until
   that module is present, a gentle simulator stands in so every screen,
   alert and family view works end to end. */
import { getState, setState, logEvent } from "./store";

export const LIMITS = { pulseHigh: 110, pulseLow: 45, sysHigh: 160, diaHigh: 100 };

type VitalListener = (v: { pulse: number; sys: number; dia: number }) => void;
type AlertListener = (kind: "pulse-high" | "pulse-low" | "bp-high", value: string) => void;

let timer: ReturnType<typeof setInterval> | null = null;
const vitalListeners = new Set<VitalListener>();
const alertListeners = new Set<AlertListener>();
let lastAlertAt = 0;

export const bleAvailable = () => false; // flips on in the dev build with ble-plx

export function braceletConnected(): boolean {
  return !!getState().profile.braceletName;
}

export function connectBracelet(name: string) {
  setState((s) => ({ profile: { ...s.profile, braceletName: name } }));
  logEvent("bracelet_connected", name);
  startMonitoring();
}

export function disconnectBracelet() {
  setState((s) => ({ profile: { ...s.profile, braceletName: null } }));
  stopMonitoring();
}

export function startMonitoring() {
  if (timer || !braceletConnected()) return;
  timer = setInterval(() => {
    /* simulator: a believable resting rhythm */
    const prev = getState().vitals;
    const pulse = Math.round(Math.min(96, Math.max(58, (prev.pulse ?? 72) + (Math.random() * 6 - 3))));
    const sys = Math.round(Math.min(150, Math.max(105, (prev.sys ?? 124) + (Math.random() * 6 - 3))));
    const dia = Math.round(Math.min(98, Math.max(66, (prev.dia ?? 80) + (Math.random() * 4 - 2))));
    record({ pulse, sys, dia });
  }, 5000);
}

export function stopMonitoring() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function record(v: { pulse?: number; sys?: number; dia?: number }) {
  const now = Date.now();
  setState((s) => ({
    vitals: {
      pulse: v.pulse ?? s.vitals.pulse,
      sys: v.sys ?? s.vitals.sys,
      dia: v.dia ?? s.vitals.dia,
      at: now, source: braceletConnected() ? "bracelet" : "manual",
    },
    vitalsLog: [...s.vitalsLog.slice(-499), { at: now, ...v }],
  }));
  if (v.pulse != null && v.sys != null && v.dia != null) {
    vitalListeners.forEach((l) => l({ pulse: v.pulse!, sys: v.sys!, dia: v.dia! }));
  }
  maybeAlert(v);
}

function maybeAlert(v: { pulse?: number; sys?: number; dia?: number }) {
  if (Date.now() - lastAlertAt < 5 * 60_000) return; // one worry at a time
  let fire: Parameters<AlertListener> | null = null;
  if (v.pulse != null && v.pulse >= LIMITS.pulseHigh) fire = ["pulse-high", `${v.pulse}`];
  else if (v.pulse != null && v.pulse > 0 && v.pulse <= LIMITS.pulseLow) fire = ["pulse-low", `${v.pulse}`];
  else if ((v.sys != null && v.sys >= LIMITS.sysHigh) || (v.dia != null && v.dia >= LIMITS.diaHigh))
    fire = ["bp-high", `${v.sys ?? "?"}/${v.dia ?? "?"}`];
  if (fire) {
    lastAlertAt = Date.now();
    logEvent("health_alert", fire.join(" "));
    alertListeners.forEach((l) => l(...fire!));
  }
}

export function onVitals(fn: VitalListener) { vitalListeners.add(fn); return () => vitalListeners.delete(fn); }
export function onHealthAlert(fn: AlertListener) { alertListeners.add(fn); return () => alertListeners.delete(fn); }

/** For testing the M4 flow from the health screen. */
export function simulateHighPulse() { record({ pulse: 128 }); }
