# NAVI-VICA — turning on cloud accounts

The app works **immediately with no setup** — accounts are saved on the device.
Follow these steps only when you want people to sign in from any phone or computer,
with real password-reset emails and automatic backup.

Everything below is on Supabase's free tier.

---

## 1. Create the project

1. Go to **supabase.com** → *Start your project* → sign in with GitHub.
2. **New project**. Pick a name (`navi-vica`), a strong database password, and the
   region closest to your users. Wait about two minutes for it to build.

## 2. Create the table

Open **SQL Editor** → *New query*, paste all of this, and press **Run**:

```sql
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text,
  phone       text,
  conditions  jsonb default '[]'::jsonb,
  details     jsonb default '{}'::jsonb,
  emergency   jsonb default '{}'::jsonb,
  data        jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"   on public.profiles
  for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);
```

Row Level Security means each person can only ever read or write **their own row**,
even though the anon key is public. This is the standard, safe Supabase pattern.

## 3. Copy your keys into the app

In Supabase: **Project Settings → API**. Copy *Project URL* and the *anon public* key.

Open `config.js` in the app folder and fill it in:

```js
window.VICA_CONFIG = {
  SUPABASE_URL: "https://YOURPROJECT.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  SITE_URL: "https://navi-vica.vercel.app"
};
```

`SITE_URL` is where the password-reset email sends people back to. Use your real
Vercel address.

## 4. Set the redirect URL

Supabase → **Authentication → URL Configuration**.
Set *Site URL* to your Vercel address and add it under *Redirect URLs* too.
Without this, reset links will bounce.

## 5. Two choices about friction

**Email confirmation.** Supabase asks new users to confirm their email by default.
For elderly users that extra step causes drop-off. Under
**Authentication → Providers → Email**, you can switch *Confirm email* off so people
are signed in the moment they register. The app handles either setting — if
confirmation stays on, it says so kindly and lets them keep using the app meanwhile.

**Phone sign-in.** Signing in with a phone number needs an SMS provider (Twilio,
MessageBird, Vonage), which costs money. Under **Authentication → Providers → Phone**
you can enable a provider and turn *Confirm phone* off to allow phone + password
sign-in without sending codes. If you skip this, phone numbers are still saved on the
profile and work for device sign-in — people just use email for the cloud.

## 6. Deploy

Upload the whole folder to Vercel as before. That's it.

---

## How it behaves

| Situation | What happens |
|---|---|
| Cloud configured, online | Real account; signs in on any device; data synced automatically |
| Cloud configured, offline | Everything keeps working; changes queue and upload when signal returns |
| Cloud not configured | Device accounts, exactly as before; transfer code moves them |
| New phone, first sign-in | Needs internet once, then works offline afterwards |
| Forgot password (email) | Real reset email with a link |
| Forgot password (offline / no email) | Falls back to the two security questions |

## Privacy

Camera frames and microphone audio are **never** uploaded — all vision and speech
processing happens on the device. Only what the person typed or chose is synced:
their name, contact details, conditions, reminders, contacts, notes and settings.
Passwords are never stored anywhere in readable form.
