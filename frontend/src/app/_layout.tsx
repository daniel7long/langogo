import { useEffect, useRef, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';

import { saveConsent } from '../../api/app';
import useUsagePing from '../../hooks/useUsagePing';
import { clearPendingConsent, getPendingConsent, initAuth } from '../../api/auth';
import { uiLangReady, useUiLang } from '../../i18n';
import DialogHost from '../../components/DialogHost';
import useAuth from '../../hooks/useAuth';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const { enabled, ready, session } = useAuth();
  const uiLang = useUiLang();
  const [langReady, setLangReady] = useState(false);
  useEffect(() => {
    uiLangReady.then(() => setLangReady(true));
  }, []);
  const router = useRouter();
  const segments = useSegments();
  useUsagePing(!enabled || !!session, segments[0] === 'free-talk' ? 'freetalk' : null);
  const navState = useRootNavigationState();

  useEffect(() => {
    initAuth();
  }, []);

  // Signed out -> the sign-in screen. Signed in -> away from it.
  const signedIn = !enabled || !!session;
  const onAuthScreen = segments[0] === 'auth';
  useEffect(() => {
    if (!enabled || !ready || !navState?.key) return;
    if (!signedIn && !onAuthScreen) router.replace('/auth');
    else if (signedIn && onAuthScreen) router.replace('/');
  }, [enabled, ready, navState?.key, signedIn, onAuthScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // The research choice made on the sign-up screen is sent once, right after the first sign-in.
  useEffect(() => {
    if (!enabled || !session) return;
    getPendingConsent().then((value) => {
      if (value === null) return;
      saveConsent(value)
        .then(clearPendingConsent)
        .catch(() => {}); // tried again on the next start
    });
  }, [enabled, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for the fonts (render anyway if they fail) and for the saved session to be read.
  // Changing the app language re-draws every screen, then returns to Settings.
  const firstLang = useRef(uiLang);
  useEffect(() => {
    if (uiLang !== firstLang.current && navState?.key) {
      firstLang.current = uiLang;
      router.replace('/settings');
    }
  }, [uiLang]); // eslint-disable-line react-hooks/exhaustive-deps

  if ((!loaded && !error) || !ready || !langReady) return null;

  return (
    <>
      <Stack key={uiLang} screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }} />
      <DialogHost />
    </>
  );
}
