# Langogo — Low-Anxiety Speaking Practice App

> *Speak a language freely and confidently.*

[![Live demo](https://img.shields.io/badge/Live%20demo-langogo--v3.vercel.app-2ea44f?style=for-the-badge)](https://langogo-v3.vercel.app)

Langogo is a language-learning app built around one idea: **speaking gets easier when practising feels safe.** Learners rehearse real dialogues out loud, get immediate feedback, and can retry as often as they like, with no audience and no pressure.

Designed and built at the **CMU Online Learning Center**.

<!-- Add 3–4 screenshots here for maximum impact, e.g.:
<p align="center"><img src="docs/screenshots/lesson-map.png" width="22%"> <img src="docs/screenshots/speaking.png" width="22%"> <img src="docs/screenshots/feedback.png" width="22%"></p>
-->

| | |
| --- | --- |
| **Live demo** | <https://langogo-v3.vercel.app> |
| **Type** | Language-learning app (Expo, web build deployed) |
| **My role** | UX Designer & Front-End Developer |
| **Languages** | French, Spanish, German, Japanese, Korean, Mandarin Chinese |

---

## The problem

Many learners can read and write a language but freeze when they have to speak it. Fear of making mistakes in front of other people is the biggest barrier, so Langogo removes the audience, gives feedback straight away and makes retrying free.

## Key features

- **Level test and result:** a short French level test places the learner and shows their result.
- **Favourite topics:** learners choose the topics they care about.
- **Lesson map and profile:** a clear path through levels and lessons, with progress at a glance.
- **Speaking dialogues:** record your own voice in a guided conversation, then **retry** until you are happy.
- **Immediate pronunciation feedback:** speech is scored right after each attempt.
- **Key words and vocab notes:** save and revisit the words that matter.
- **Speaking records:** review earlier recordings.
- **Unlockable topics:** a shop-style screen for unlocking new topics.
- **Community leaderboard** to keep practice motivating.
- **Sharing and settings.**

## Design and UX highlights

- **Anxiety-aware interaction design:** immediate feedback, unlimited retries and a private practice space are product decisions, not afterthoughts.
- **Figma design system:** variable collections for **Primitives**, **Tokens** (Light and Dark modes) and **Layout**, plus a component library (for example buttons with state and type variants).
- **Distinct brand:** green and orange accents carried through the logo and screens.
- **Redesigned from scratch** in Figma Make after user testing showed the first UI felt rough, keeping every existing feature.

## Tech stack

| Layer | Technology |
| --- | --- |
| Front end | **Expo / React Native** (JavaScript), running as a web build |
| Back end | **FastAPI** (Python) |
| Speech | **Azure Speech** for pronunciation scoring |
| Design | **Figma** (variables, tokens, components) and Figma Make |
| Hosting | **Vercel** (front end) |

<!-- TODO(stack): after reviewing package.json / requirements.txt, add navigation, audio libraries, state management and the back-end host. -->

## Engineering highlights

- **Design-to-code token pipeline.** Figma variables are exported with the Design Tokens plugin to `design_tokens.json`, which generates the app's `theme/index.js`. Design and code share one source of truth, so a colour or spacing change in Figma flows straight into the app.
- **One codebase, many surfaces.** Expo lets the same React Native code target native devices and the web build that is live today.
- **Multi-language back end.** Lessons for all six languages are served from the FastAPI back end, organised by language and level (French alone has six levels of four lessons).
- **Research-ready, privacy-conscious data.** Speech timing data is collected for future research but stays **only in the back end** and is never shown to learners.

## Roadmap

- Public launch with sign-up via Google account or personal email
- At least 12 lessons (three levels) for every language
- Testing on physical phones with Expo Go

---

**Designed and built by [Daniel Long](https://daniel7long.com)** · M.S. Human-Computer Interaction, Carnegie Mellon University
