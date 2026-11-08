import { Redirect } from 'expo-router';

import { getMe } from '../../api/app';
import AsyncState from '../../components/AsyncState';
import Screen from '../../components/Screen';
import { ListSkeleton } from '../../components/Skeleton';
import useAsync from '../../hooks/useAsync';
import LanguageScreen from '../../screens/LanguageScreen';

// The app opens on the learner's lessons when a language has already been chosen. Only a first-time
// learner (no language yet) starts on "Choose the language you want to learn". Changing the language
// later is done from the menu / Settings, which opens /language.
export default function Start() {
  const state = useAsync(getMe, []);
  // Until we know who this is, show a light placeholder (never the language picker for a returning learner);
  // if the server can't be reached, AsyncState shows its "Try again" card.
  return (
    <AsyncState state={state} skeleton={<Screen><ListSkeleton rows={6} /></Screen>}>
      {(me) => (me.language ? <Redirect href="/courses" /> : <LanguageScreen />)}
    </AsyncState>
  );
}
