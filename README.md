<div align="center">

# Langogo

### Speak a language freely and confidently.

A low-anxiety speaking-practice app for language learners.

[![Live demo](https://img.shields.io/badge/LIVE%20DEMO-LANGOGO--V3.VERCEL.APP-D95F0E?style=for-the-badge&labelColor=4B4B4B)](https://langogo-v3.vercel.app)

</div>

Langogo helps learners get past the fear of speaking. They hear a model line, record their own, and get immediate, encouraging feedback on pronunciation, fluency and completeness. Retry is always one tap, grades are tuned to be friendly to beginners, and nothing is shown publicly unless the learner chooses to share it.

Built as a CMU Online Learning Center project by **Daniel Long** (M.S. Human-Computer Interaction and M.A. Applied Linguistics, Carnegie Mellon University). Design, front end, back end and lesson content were all produced for this project.

| | |
| --- | --- |
| **Live demo** | [https://langogo-v3.vercel.app](https://langogo-v3.vercel.app) |
| **Type** | Mobile-first web app for speaking practice |
| **Languages** | French, Spanish, German, Italian, Arabic, Chinese, Korean, Japanese |
| **Front end** | Expo SDK 57, Expo Router, React Native (JavaScript), react-native-web, expo-audio |
| **Back end** | Python, FastAPI, Pydantic |
| **Auth and data** | Supabase Auth (Google and email), Supabase PostgreSQL |
| **Speech** | Azure Speech pronunciation assessment, Azure neural voices for model audio |
| **Hosting** | Vercel (web app), Render (API) |

## Features

- **Placement test.** Seven sentence-completion questions (the last three are advanced), then one spoken sentence scored like a dialogue line. The final score weights the questions 70% and speaking 30%, and places the learner at the matching level and lesson of the 36-lesson French course.
- **Guided speaking practice.** A prep screen with key words and notes, a model line that plays once, then the learner records.
- **Instant feedback.** Pronunciation, Fluency and Completeness scores, plus the words worth practising.
- **Beginner-friendly grading.** A+ at 85 or above, A at 75, B+ at 65, B at 55, otherwise C. There is no D, so beginners are not discouraged.
- **Consistent pronunciation everywhere.** Every word and sentence has a recorded neural-voice clip, so audio sounds the same on every phone and browser.
- **Eight languages.** Twelve lessons in 3 levels each, and 36 lessons in 9 levels for French (A1 to C1). Arabic is displayed right to left. Lesson content is data (JSON), not hard-coded strings.
- **Lesson summary.** Grade badge, flowers (points) count-up, three score rings and a "practise these" list.
- **Community.** A weekly leaderboard within the same language, and shareable links for a single speaking record.
- **Accounts that keep your progress.** Sign in with Google or email, with email confirmation, password reset and in-app account deletion. Progress is stored in a managed PostgreSQL database.
- **Privacy by design.** Speech data for research is collected only with the learner's opt-in consent, stored with an anonymous participant ID, and removed when consent is withdrawn or the account is deleted.

## Design

A Figma-based design system with tokens exported to `frontend/theme/index.js`: warm orange `#D95F0E`, background `#FFFCF8`, Nunito, rounded 16/20/28 px corners. Every screen has loading, empty and error states.

## Architecture

```
Learner's phone or browser
        |
        v
Expo web app (Vercel) ---- HTTPS + JWT ----> FastAPI (Render) ---- Azure Speech (scoring)
        |                                          |
        '---- Supabase Auth (sign-in) ----         '---- Supabase PostgreSQL (learner data)
```

## Repository layout

```
backend/    FastAPI app, routers, scoring, accounts, lesson content (content/<lang>/lessons)
frontend/   Expo app (routes, screens, components, api, hooks, theme)
docs/       Specification and setup notes (AUTH_SETUP.md, DATA_STORAGE.md)
```

## Privacy and security

- Every API call except health, docs, share links and the key-protected admin page requires a valid login token.
- Secrets live only in the hosting platforms' environment settings. No keys are stored in the repository.
- Learner data sits in a database with row-level security enabled.

## Roadmap

Real-device testing across more phones, Terms and Privacy pages, an age gate, a recording-retention window, and an always-on production host.

## Author

**Daniel Long**, Carnegie Mellon University. Portfolio: [daniel7long.com](https://daniel7long.com)
