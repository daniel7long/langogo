import { useEffect, useState } from 'react';

import { getMe, saveSettings } from '../api/app';
import { applySettings, getSettings, settingsLoaded, subscribeSettings } from '../utils/settingsStore';

// { settings, update(patch) }: the learner's settings, loaded once and shared by every screen.
export default function useSettings() {
  const [settings, setSettings] = useState(getSettings());

  useEffect(() => {
    const off = subscribeSettings(setSettings);
    if (!settingsLoaded()) getMe().catch(() => {}); // getMe applies the saved settings
    setSettings(getSettings());
    return off;
  }, []);

  const update = async (patch) => {
    applySettings({ ...getSettings(), ...patch }); // show the change straight away
    try {
      applySettings(await saveSettings(patch));
    } catch (e) {
      // the screen keeps the new value for this session; it is saved the next time a change goes through
    }
  };

  return { settings, update };
}
