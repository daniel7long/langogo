# Building the Android app (APK)

An APK can't be built inside Claude's workspace (no Android SDK and no access to Expo's build servers),
so build it on your computer with Expo's cloud build (EAS). It takes about 15 minutes the first time and needs
no Android Studio.

## One-time setup
1. Make a free account at https://expo.dev and sign in from PowerShell:
   ```powershell
   cd "D:\00 PrCodes\00 Langogo\frontend"
   npm install -g eas-cli
   eas login
   ```
2. Install the picture picker used by the new profile photo feature:
   ```powershell
   npx expo install expo-image-picker
   ```
3. In `app.json` (inside `"expo"`) make sure these exist (merge with what you have):
   ```json
   "android": { "package": "com.longhao.langogo", "permissions": ["RECORD_AUDIO", "CAMERA", "READ_MEDIA_IMAGES"] },
   "plugins": [
     "expo-router",
     ["expo-image-picker", { "photosPermission": "Langogo uses your photos to set your profile picture.", "cameraPermission": "Langogo uses the camera to take your profile picture." }]
   ]
   ```
   (Keep the other plugins you already have. The package name must be unique; change it if you like, but then never change it again.)
4. Create `frontend/eas.json` (or add the `preview` profile if you already have one):
   ```json
   {
     "cli": { "version": ">= 12.0.0" },
     "build": {
       "preview": {
         "distribution": "internal",
         "android": { "buildType": "apk" },
         "env": { "EXPO_PUBLIC_API_URL": "https://langogo.onrender.com" }
       }
     }
   }
   ```
   `EXPO_PUBLIC_API_URL` is baked into the app when it is built, so it must be your live backend address,
   not localhost. Add your Supabase variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, ...)
   to the same `env` block, exactly as in your frontend `.env`. They are public keys. Never put
   `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` or `DATABASE_URL` in the app.

## Build
```powershell
cd "D:\00 PrCodes\00 Langogo\frontend"
eas build -p android --profile preview
```
When it finishes, EAS prints a link and a QR code. Open the link on the phone (or download the `.apk` and send it
to the phone), allow "install unknown apps" when Android asks, and install.

## Notes
- Google sign-in: if you use it, add the app's package name and the signing certificate fingerprint (shown by
  `eas credentials`) in your Google/Supabase OAuth settings, otherwise Google login fails inside the APK.
- Every time you change the frontend code, build again. Backend changes need no new APK.
- To publish on Google Play later, use `"buildType": "app-bundle"` in a `production` profile.
