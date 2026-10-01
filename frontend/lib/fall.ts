/* Fall detection from the phone's own accelerometer (expo-sensors):
   a hard jolt within a quiet window triggers the M5 countdown screen. */
import { Accelerometer } from "expo-sensors";
import { logEvent } from "./store";

let sub: { remove(): void } | null = null;
let lastMag = 9.8;
let cooldownUntil = 0;
let onFall: (() => void) | null = null;

export function startFallDetection(handler: () => void) {
  onFall = handler;
  if (sub) return;
  Accelerometer.setUpdateInterval(120);
  sub = Accelerometer.addListener(({ x, y, z }) => {
    const mag = Math.sqrt(x * x + y * y + z * z) * 9.81;
    const jerk = Math.abs(mag - lastMag);
    lastMag = mag;
    if (jerk > 25 && Date.now() > cooldownUntil) {
      cooldownUntil = Date.now() + 30_000;
      logEvent("fall_suspected");
      onFall?.();
    }
  });
}

export function stopFallDetection() {
  sub?.remove(); sub = null; onFall = null;
}
