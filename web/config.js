/* ===================================================================
   NAVI-VICA — cloud configuration
   -------------------------------------------------------------------
   Paste your Supabase project details below to turn on cloud accounts.
   Leave them empty and the app runs perfectly in device-only mode.

   Where to find these:  supabase.com → your project →
   Project Settings → API →  "Project URL"  and  "anon public" key.

   The anon key is SAFE to publish — it is designed for browsers and is
   restricted by the Row Level Security rules in SETUP.md.
   =================================================================== */
window.VICA_CONFIG = {
  SUPABASE_URL: "",       // e.g. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "",  // e.g. "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  SITE_URL: "https://navi-vica-v10.vercel.app",  // for reset-password links

  /* Optional AI backend (the FastAPI server in this repo's /backend folder).
     When set, chat questions the on-device rules can't answer are sent to
     Gemini via POST {BACKEND_URL}/api/process-voice. Leave empty and chat
     still works fully offline with built-in responses. */
  BACKEND_URL: ""         // e.g. "https://your-backend.example.com"
};
