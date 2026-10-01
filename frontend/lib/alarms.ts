/* Medicine alarms that reach the lock screen: expo-notifications with a
   high-importance channel, spoken + vibrating, with "I took it" and
   "Remind me in 10 minutes" actions — exactly the mockup's M3 screen. */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Medicine, getState, setState, logEvent } from "./store";

export const MED_CATEGORY = "medicine-alarm";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

export async function initAlarms() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("medicine", {
      name: "Medicine alarms",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationCategoryAsync(MED_CATEGORY, [
    { identifier: "TAKEN", buttonTitle: "I took it", options: { opensAppToForeground: false } },
    { identifier: "SNOOZE", buttonTitle: "Remind me in 10 minutes", options: { opensAppToForeground: false } },
  ]);
}

export async function requestAlarmPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleMedicine(med: Medicine): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for your medicine",
        body: med.name,
        sound: "default",
        categoryIdentifier: MED_CATEGORY,
        data: { medId: med.id },
        ...(Platform.OS === "android" ? { channelId: "medicine" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: med.hour, minute: med.minute,
      },
    });
    return id;
  } catch { return null; }
}

export async function cancelMedicine(med: Medicine) {
  if (med.notificationId) {
    try { await Notifications.cancelScheduledNotificationAsync(med.notificationId); } catch {}
  }
}

export async function snooze(medName: string, medId: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for your medicine", body: medName, sound: "default",
        categoryIdentifier: MED_CATEGORY, data: { medId },
        ...(Platform.OS === "android" ? { channelId: "medicine" } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 600 },
    });
  } catch {}
}

export function markTaken(medId: string) {
  setState((s) => ({
    medicines: s.medicines.map((m) =>
      m.id === medId ? { ...m, takenToday: true, lastTaken: Date.now() } : m),
  }));
  logEvent("med_taken", medId);
}

/** Wire the notification action buttons; call once at boot. */
export function attachAlarmResponses(onOpenAlarm: (medId: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const medId = String(resp.notification.request.content.data?.medId ?? "");
    const med = getState().medicines.find((m) => m.id === medId);
    const action = resp.actionIdentifier;
    if (action === "TAKEN" && med) markTaken(med.id);
    else if (action === "SNOOZE" && med) snooze(med.name, med.id);
    else if (medId) onOpenAlarm(medId); // notification body tapped → alarm screen
  });
  return () => sub.remove();
}
