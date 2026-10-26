# Logo drop-in folder

Put the Langogo logo files here. The app only reads the logo through this folder.

| File        | Used for                                                     |
|-------------|--------------------------------------------------------------|
| `logo.png`  | The wordmark at the top of every screen (currently the real logo, 1094 x 410) |

To change the logo:

1. Replace `logo.png` with the new file and keep the same name.
2. Restart Expo with a cleared cache: `npx expo start -c`.

Tips:
- Use a PNG at least 3x the largest size it is shown at (the screens show it about 160 px wide, so 480 px or wider).
- A transparent background works best. The screens are white, so a white background also works.
- The aspect ratio is read from the file, so a differently shaped logo needs no code changes.
- The app icon and splash screen are separate. They are set in `app.json`.
