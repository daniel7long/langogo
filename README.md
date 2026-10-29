# Langogo

**Speak a language freely and confidently.**

Langogo is a low-anxiety speaking-practice app for language learners. Learners hear a model line, record their own, and get immediate, encouraging feedback on pronunciation, fluency and completeness. Retry is always one tap, grades are tuned to be friendly to beginners, and nothing is shown publicly unless the learner chooses to share it.

Built as a CMU Online Learning Center project by Daniel Long (M.S. HCI + M.A. Applied Linguistics, Carnegie Mellon University). Design, front end, back end and lesson content were all produced for this project.

## What it does

- **Six languages:** French, Spanish, German, Chinese, Korean and Japanese, with at least 12 lessons in 3 levels each (French has 24). Lesson content is data (JSON), not hard-coded strings.
- **Guided speaking practice:** prep screen with key words and notes, the model line auto-plays once, then the learner records.
- **Instant feedback:** Azure Speech pronunciation assessment returns Pronunciation, Fluency and Completeness scores plus words to practise.
- **Beginner-friendly grading:** A+ at 85 or above, A at 75, B+ at 65, B at 55, otherwise C. There is no D, so beginners are not discouraged.
- **Lesson complete screen:** grade badge, flowers (points) count-up, three score rings, a "practise these" list and sharing.
- **Community:** weekly leaderboard by flowers within the same language; learners can share a single speaking record by link.
- **Accounts:** sign in with Google or email and password (Supabase Auth), with email confirmation, password reset and in-app account deletion.
- **Privacy by design:** speech data for research is collected only with the learner's opt-in consent, stored on the server with an anonymous participant ID, and removed when consent is withdrawn or the account is deleted.

## Design

Figma-based design system with tokens exported to `frontend/theme/index.js`: warm orange `#D95F0E`, background `#FFFCF8`, Nunito, rounded 16/20/28 px corners. Every screen is built with loading, empty and error states.

## Tech stack

| Layer | Technology |
| --- | --- |
| Client | Expo SDK 57, Expo Router, React Native (JavaScript), react-native-web, expo-audio, expo-speech, react-native-svg |
| Backend | Python, FastAPI, Pydantic, PyJWT |
| Auth | Supabase Auth (Google OAuth and email), JWT verified by the backend |
| Speech scoring | Azure Speech pronunciation assessment, behind one internal interface |
| Storage | PostgreSQL on Supabase for learner data in production (set `DATABASE_URL`); SQLite file for local runs |

## Repository layout

```
backend/    FastAPI app, routers, scoring, accounts, lesson content (content/<lang>/lessons)
frontend/   Expo app (src/app routes, screens, components, api, hooks, theme)
docs/       Specification and setup notes (AUTH_SETUP.md)
```

## Run it locally

You need Node.js 20+, Python 3.11+, an Azure Speech key, and (optional) a Supabase project. Without Supabase settings the backend runs a single local "dev" learner, so you can try the app without accounts.

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy env.example .env           # macOS/Linux: cp env.example .env, then fill in your values
uvicorn main:app --reload --host 0.0.0.0
```

The API runs at http://localhost:8000 (interactive docs at `/docs`, health check at `/health`).

**Frontend**

```bash
cd frontend
npm install
```

Create `frontend/.env` with:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=...        # only when accounts are on
EXPO_PUBLIC_SUPABASE_ANON_KEY=...   # anon key only, never the service key
```

```bash
npx expo start
```

Press `w` for the web version at http://localhost:8081, or scan the QR code with Expo Go. After editing `.env`, restart with `npx expo start -c`.

See `docs/AUTH_SETUP.md` for the Supabase and Google sign-in setup.

## Security and privacy notes

- `.env` files are git-ignored. Never commit or paste keys; the Supabase service key belongs only in `backend/.env`.
- Every API call except health, docs, share links and the key-protected admin page requires a valid login token.
- Learner data lives in the Supabase database (`DATABASE_URL`, server only). Local files in `backend/data` and `backend/recordings` are git-ignored. See `docs/DATA_STORAGE.md`.

## Status

The MVP is built: lessons for six languages, speaking feedback, grading, community, sharing, accounts and a private admin user list. Backend logic is covered by tests with a mocked speech service. Still to do before a public launch: real-device testing, Terms and Privacy pages, an age gate, a recording-retention window and a paid, always-on host.

## Author

Daniel Long, Carnegie Mellon University. Portfolio: https://daniel7long.com
