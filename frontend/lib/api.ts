/* Backend bridge (FastAPI + YOLOv9 + Gemini in ../backend).
   Optional: every call degrades to an on-device answer when unset. */
const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/+$/, "");

export const backendConfigured = () => !!BASE;

export async function analyzeScene(imageBase64: string, profile: string, confidence = 0.2): Promise<{
  ai_description: string;
  detections: { class_name: string; confidence: number; position: string }[];
  safety_warnings: string[];
  navigation_hints: string[];
} | null> {
  if (!BASE) return null;
  try {
    const r = await fetch(`${BASE}/api/analyze-scene`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: imageBase64, user_profile: profile, confidence }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function askVica(text: string, context?: string): Promise<{ response_text: string; action: string | null } | null> {
  if (!BASE) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const r = await fetch(`${BASE}/api/process-voice`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context: context ?? "NAVI-VICA mobile app" }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
