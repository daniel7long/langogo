import { Linking, Platform, Share } from 'react-native';

import { intentUrl } from './shareLinks';

function openLink(url) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url);
  }
}

// Shares a result to one network. Returns { ok, message? }; show `message` to the user if present.
// Important on the web: window.open only works if it runs straight after the tap, so nothing
// asynchronous may happen before it. That is why the payload is loaded BEFORE the buttons are enabled.
export async function shareTo(target, payload) {
  const message = `${payload.text} ${payload.url}`;
  const link = intentUrl(target, payload);

  if (link) {
    openLink(link);
    return { ok: true };
  }

  // Instagram: there is no link or API for posting from another app.
  if (Platform.OS !== 'web') {
    // Phone: the system share sheet (pick Instagram, Messages, ...).
    try {
      await Share.share({ message });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: "Couldn't open the share sheet." };
    }
  }

  const phoneBrowser = typeof navigator !== 'undefined' && !!navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (phoneBrowser) {
    try {
      await navigator.share({ text: payload.text, url: payload.url });
      return { ok: true };
    } catch (e) {
      return { ok: e?.name === 'AbortError' };
    }
  }

  // Desktop browser: open Instagram and put the text on the clipboard to paste into a post.
  window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  try {
    await navigator.clipboard.writeText(message);
    return { ok: true, message: 'Your caption was copied. Instagram can\'t be posted to from a link, so paste it into a new post or story.' };
  } catch (e) {
    return { ok: true, message: `Instagram can't be posted to from a link. Copy this caption:\n\n${message}` };
  }
}

// "Copy text": puts the caption on the clipboard (web) or opens the share sheet with it (phone, where
// no clipboard package is installed). Returns { ok, message? }.
export async function copyCaption(payload) {
  const message = `${payload.text} ${payload.url}`;
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(message);
      return { ok: true, message: 'Copied. Paste it anywhere you like.' };
    } catch (e) {
      return { ok: false, message: `Copy this caption:\n\n${message}` };
    }
  }
  try {
    await Share.share({ message });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: "Couldn't open the share sheet." };
  }
}
