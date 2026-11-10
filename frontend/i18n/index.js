import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import fr from './locales/fr';
import es from './locales/es';
import zh from './locales/zh';
import yue from './locales/yue';
import ko from './locales/ko';
import ja from './locales/ja';
import de from './locales/de';
import it from './locales/it';
import ar from './locales/ar';
import pt from './locales/pt';
import ru from './locales/ru';
import ro from './locales/ro';
import hi from './locales/hi';
import bn from './locales/bn';
import id from './locales/id';

// The language the app's own buttons and menus are shown in. (Lesson content has its own language.)
export const UI_LANGS = [
  { id: 'en', name: 'English', native: 'English' },
  { id: 'fr', name: 'French', native: 'Français' },
  { id: 'es', name: 'Spanish', native: 'Español' },
  { id: 'zh', name: 'Mandarin', native: '中文（普通话）' },
  { id: 'yue', name: 'Cantonese', native: '粵語' },
  { id: 'ko', name: 'Korean', native: '한국어' },
  { id: 'ja', name: 'Japanese', native: '日本語' },
  { id: 'de', name: 'German', native: 'Deutsch' },
  { id: 'it', name: 'Italian', native: 'Italiano' },
  { id: 'ar', name: 'Arabic', native: 'العربية' },
  { id: 'pt', name: 'Portuguese', native: 'Português' },
  { id: 'ru', name: 'Russian', native: 'Русский' },
  { id: 'ro', name: 'Romanian', native: 'Română' },
  { id: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { id: 'bn', name: 'Bengali', native: 'বাংলা' },
  { id: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
];

const DICTS = { fr, es, zh, yue, ko, ja, de, it, ar, pt, ru, ro, hi, bn, id };
const KEY = 'langogo_ui_lang';
const WEB = Platform.OS === 'web';

let current = 'en';
const listeners = new Set();
const compiled = {}; // lang -> [{ re, out }]

async function read() {
  try {
    if (WEB) return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
async function write(value) {
  try {
    if (WEB) globalThis.localStorage?.setItem(KEY, value);
    else await SecureStore.setItemAsync(KEY, value);
  } catch {
    /* the choice just won't be remembered */
  }
}

export const getUiLang = () => current;

export function setUiLang(lang) {
  if (!DICTS[lang]) lang = 'en';
  if (lang === current) return;
  current = lang;
  write(lang);
  listeners.forEach((fn) => fn(lang));
}

// Load the saved choice once at start-up; resolves when the app can render in the right language.
export const uiLangReady = read().then((saved) => {
  if (saved && DICTS[saved]) current = saved;
  return current;
});

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patterns(lang) {
  if (compiled[lang]) return compiled[lang];
  const list = [];
  for (const [key, out] of Object.entries(DICTS[lang] || {})) {
    if (!key.includes('{')) continue;
    const names = [];
    const src = key
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = part.match(/^\{(\w+)\}$/);
        if (m) {
          names.push(m[1]);
          return '(.+?)';
        }
        return esc(part);
      })
      .join('');
    list.push({ re: new RegExp(`^${src}$`), names, out });
  }
  compiled[lang] = list;
  return list;
}

// Translate one string. Unknown strings come back unchanged (English).
export function t(str) {
  if (typeof str !== 'string' || current === 'en' || !str) return str;
  const dict = DICTS[current];
  if (!dict) return str;
  const lead = str.match(/^\s*/)[0];
  const trail = str.match(/\s*$/)[0];
  const core = str.trim();
  if (!core) return str;
  if (dict[core] !== undefined) return lead + dict[core] + trail;
  for (const p of patterns(current)) {
    const m = core.match(p.re);
    if (m) {
      let out = p.out;
      p.names.forEach((n, i) => {
        out = out.split(`{${n}}`).join(t(m[i + 1]));
      });
      return lead + out + trail;
    }
  }
  return str;
}

// Children of a <Text>: translate strings; a run of strings and numbers is translated as one sentence.
export function translateChildren(children) {
  if (current === 'en') return children;
  if (typeof children === 'string') return t(children);
  if (Array.isArray(children)) {
    const flat = children.flat(Infinity);
    if (flat.length && flat.every((c) => typeof c === 'string' || typeof c === 'number')) {
      const joined = flat.join('');
      const out = t(joined);
      return out === joined ? children : out;
    }
    return children.map((c) => (typeof c === 'string' ? t(c) : c));
  }
  return children;
}

export function useUiLang() {
  const [lang, setLang] = useState(current);
  useEffect(() => {
    const fn = (l) => setLang(l);
    listeners.add(fn);
    setLang(current);
    return () => listeners.delete(fn);
  }, []);
  return lang;
}
