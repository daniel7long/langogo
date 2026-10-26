# Share setup (Facebook, Instagram, LinkedIn, X)

## What already works (no API keys, nothing to register)

| Network | What the app does |
|---------|-------------------|
| X | Opens `twitter.com/intent/tweet` with the text and link filled in |
| Facebook | Opens `facebook.com/sharer/sharer.php?u=<link>` |
| LinkedIn | Opens `linkedin.com/sharing/share-offsite/?url=<link>` |
| Instagram | Phone app: the system share sheet. Phone browser: the browser's share sheet. Desktop browser: opens instagram.com and copies the caption to the clipboard |

The code is in `frontend/utils/shareLinks.js` (the links), `frontend/utils/share.js` (what happens on tap)
and `frontend/components/ShareSheet.js` (the popup). The text and link come from the backend:
`GET /share/{record_id}/payload` (see `backend/routers/share.py`).

These share links are the officially supported "web share" routes, so no developer account is needed.

## Step 1: make link previews work (Facebook and LinkedIn)

Facebook and LinkedIn ignore your text and build the post from the link's preview. They read the
Open Graph tags of `GET /share/{record_id}` (title, description, picture). For that to work the
link must be reachable from the internet. `http://localhost:8000` is not.

1. Put the backend on a public address (a small cloud host, or a tunnel such as ngrok for a quick test).
2. Tell the backend its public address before starting it. PowerShell:
   ```powershell
   $env:LANGOGO_PUBLIC_URL = "https://api.your-domain.com"   # where the backend is reachable
   $env:LANGOGO_APP_URL    = "https://your-domain.com"       # where the "Try Langogo" button goes
   uvicorn main:app --reload --host 0.0.0.0
   ```
3. Replace `backend/static/share-card.png` with your own picture (1200 x 630 px, PNG or JPG under 5 MB).
4. Check the preview with Facebook's Sharing Debugger (developers.facebook.com/tools/debug/) and
   LinkedIn's Post Inspector (linkedin.com/post-inspector/). They cache previews, so use their
   "scrape again" button after you change the picture or text.

Some tunnels show a warning page before your site, which can stop these crawlers from seeing the tags.
If a preview stays empty on a tunnel, test on a real deployment.

## Step 2: X

Nothing more is needed. Posting to X through its API (OAuth, paid access) is only for posting
on someone's behalf without them seeing a compose window, and is not what a share button should do.

## Step 3: LinkedIn

Nothing more is needed. LinkedIn's "Share on LinkedIn" API (the `w_member_social` permission) needs an
approved LinkedIn app and a sign-in flow. Use it only if you want to post without showing LinkedIn's
own compose window.

## Step 4: Instagram (the honest part)

Instagram has no link or API for "share this to my feed". What exists:

- **System share sheet (already in the app).** On a phone, the user can pick Instagram from the list.
  What appears there is decided by Instagram and the phone, and it may only offer Direct messages.
- **Instagram Stories sharing (optional, phone app only).** The app sends a picture to Instagram's
  Stories composer. It needs a development build (it does NOT work in Expo Go) and a Meta
  (Facebook) developer App ID from developers.facebook.com. Sketch, to be checked against the
  current `react-native-share` documentation before you rely on it:
  ```bash
  npx expo install react-native-share expo-dev-client
  ```
  ```js
  import Share from 'react-native-share';
  await Share.shareSingle({
    social: Share.Social.INSTAGRAM_STORIES,
    appId: 'YOUR_META_APP_ID',
    backgroundImage: 'https://api.your-domain.com/static/share-card.png',
  });
  ```
  On iOS also list `instagram-stories` under `LSApplicationQueriesSchemes` (in `app.json`,
  `ios.infoPlist`). Then build with `npx expo run:android` or `npx expo run:ios`.
- **Instagram Graph API "content publishing".** This lets a business or creator account publish to
  its OWN account from a server. It cannot post for your users, so it is not a share button.

## Before launch

- The record ids in the share links (`r1`, `r2`, ...) are easy to guess. The public page only shows the
  grade, lesson title and flowers, but switch to random share tokens when you add real accounts.
- Restrict CORS in `backend/main.py` to your real web address.
