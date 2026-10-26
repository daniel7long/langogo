# Accounts: Google and email sign-up

Langogo uses **Supabase Auth** for sign-in (it is free for the first 50,000 monthly users). Supabase handles
Google sign-in, email + password, confirmation emails and password reset. Your backend only checks the login
token, so it never sees a password. Without the settings below the app still runs exactly as before, with
one local test learner.

## 1. Create the Supabase project (10 minutes)
1. supabase.com > New project (pick a region close to your learners). Save the database password somewhere safe.
2. **Project Settings > API**: copy the **Project URL** and the **anon / publishable key**.

## 2. Turn on the sign-in methods
**Authentication > Sign In / Providers**
- *Email*: on. Leave "Confirm email" ON for a public launch (it stops fake sign-ups). For quick local tests you may turn it off.
- *Google*: on. It asks for a Client ID and Secret:
  1. console.cloud.google.com > create a project > **APIs & Services > OAuth consent screen** (External, add your app name and email).
  2. **Credentials > Create credentials > OAuth client ID > Web application**.
  3. Under "Authorized redirect URIs" paste the callback URL shown on Supabase's Google page
     (`https://<project>.supabase.co/auth/v1/callback`).
  4. Copy the Client ID and Client secret back into Supabase and save.

**Authentication > URL Configuration**
- *Site URL*: your web address (while testing: `http://localhost:8081`).
- *Redirect URLs*: add `http://localhost:8081`, your real web address, and for phones `langogo://**`
  (while testing in Expo Go also `exp://**`).

## 3. Tell the backend and the app
`backend/.env`
```
SUPABASE_URL=https://xxxx.supabase.co
LANGOGO_PSEUDONYM_SALT=<a long random text>
```
(Only if your project still shows a "JWT Secret" under Settings > API, also set `SUPABASE_JWT_SECRET`.)

`frontend/.env`
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
EXPO_PUBLIC_TERMS_URL=https://yourdomain.com/terms
EXPO_PUBLIC_PRIVACY_URL=https://yourdomain.com/privacy
```
Install the new packages:
```
cd backend;  pip install -r requirements.txt
cd ..\frontend;  npx expo install expo-secure-store expo-web-browser expo-linking
```
`frontend/app.json` needs `"scheme": "langogo"` (Expo Router normally has it already).
Restart uvicorn and `npx expo start --clear`.

## What is stored, and where
| What | Where |
|------|-------|
| Email, password, Google login | Supabase |
| Progress, flowers, records, notes, settings | `backend/data/langogo.db` (SQLite, one row per learner) |
| Voice recordings | `backend/recordings/<anonymous id>/` |
| Research speech log (only for learners who opted in) | `backend/data/speech_log.jsonl`, anonymous ID, no name or email |

- **Research consent** is asked on the sign-up screen (optional) and can be changed in Settings > Privacy.
  Turning it off stops logging and deletes that learner's rows from the log.
- **Delete my account** (Settings > Account) deletes the learner's database row, recordings and research rows.
  To also remove the Supabase login automatically, set `SUPABASE_SERVICE_KEY` (server only).
- Keep `LANGOGO_PSEUDONYM_SALT` secret and never change it, or the same person gets a new anonymous ID.
- Existing local progress (`data/state.json`) is imported once for the local test learner when accounts are off.
  It is not attached to any real account.

## Before a public launch (checklist)
- Deploy the backend over **HTTPS** and set `LANGOGO_PUBLIC_URL`, `LANGOGO_APP_URL`, `LANGOGO_CORS_ORIGINS`.
- Run one backend process (the learner cache is in memory) or move `db.py` to Postgres and add row locking.
- Set `LANGOGO_DEMO_LEADERBOARD=0`.
- Write a Terms of Service and a Privacy Policy (the sign-up screen links to them). Because you collect voice
  recordings and research data, have your university's ethics board (IRB) review the consent wording.
  Learners under 13 (US) or 16 (EU) need parental consent: consider an age gate.
- Voice recordings are personal data: decide how long you keep them (a scheduled clean-up is an easy next step).
- Replace the demo subscription with Stripe or RevenueCat.
- Back up `backend/data/`.
