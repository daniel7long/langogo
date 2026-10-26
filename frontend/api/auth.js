// Sign-in with Supabase Auth (Google, or email + password). The app talks to Supabase's REST API
// directly, so no extra auth library is needed. After signing in, `getAccessToken()` gives the token
// that api/client.js sends to the Langogo backend with every request.
//
// Set these in frontend/.env (see docs/AUTH_SETUP.md). Without them the app runs without accounts.
//   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

const URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const authEnabled = !!(URL && KEY);

const SESSION_KEY = 'langogo.session';
const CONSENT_KEY = 'langogo.pendingConsent';
const WEB = Platform.OS === 'web';

WebBrowser.maybeCompleteAuthSession();

// ---- Storage (secure store on phones, localStorage on the web) -------------------------
async function readItem(key) {
  try {
    if (WEB) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    return null;
  }
}
async function writeItem(key, value) {
  try {
    if (WEB) {
      if (value == null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } else if (value == null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch (e) {
    // the session then only lasts until the app closes
  }
}

// ---- The session -----------------------------------------------------------------------
let session = null; // { access_token, refresh_token, expires_at, user: { id, email } }
let ready = !authEnabled;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn({ ready, session }));
export const getSnapshot = () => ({ ready, session });
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function setSession(next) {
  session = next;
  await writeItem(SESSION_KEY, next ? JSON.stringify(next) : null);
  emit();
}

function toSession(body, fallbackUser) {
  const user = body.user ?? fallbackUser ?? {};
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
    user: { id: user.id, email: user.email },
  };
}

class AuthFail extends Error {}

// Friendly messages for the things people actually run into.
function friendly(body, status) {
  const text = String(body?.msg || body?.error_description || body?.message || body?.error || '').toLowerCase();
  if (text.includes('invalid login')) return "That email or password isn't right.";
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (text.includes('password') && (text.includes('least') || text.includes('weak') || text.includes('short'))) {
    return 'Please choose a longer password (at least 8 characters).';
  }
  if (text.includes('email') && text.includes('confirm')) return 'Please confirm your email first. Check your inbox.';
  if (text.includes('rate limit') || status === 429) return 'Too many tries. Please wait a minute and try again.';
  if (text.includes('valid email') || text.includes('invalid email')) return 'Please enter a valid email address.';
  return body?.msg || body?.error_description || 'Something went wrong. Please try again.';
}

async function gotrue(path, { method = 'POST', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${URL}/auth/v1/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', apikey: KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new AuthFail("Can't reach the sign-in service. Check your connection.");
  }
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // empty reply
  }
  if (!res.ok) throw new AuthFail(friendly(data, res.status));
  return data;
}

// ---- Public actions ------------------------------------------------------------------
export async function signUp(email, password) {
  const data = await gotrue('signup', { body: { email: email.trim(), password } });
  if (data.access_token) {
    await setSession(toSession(data));
    return { needsConfirmation: false };
  }
  return { needsConfirmation: true }; // Supabase emailed a confirmation link
}

export async function signIn(email, password) {
  const data = await gotrue('token?grant_type=password', { body: { email: email.trim(), password } });
  await setSession(toSession(data));
}

export async function resetPassword(email) {
  await gotrue('recover', { body: { email: email.trim() } });
}

async function sessionFromTokens(access_token, refresh_token, expires_in) {
  const user = await gotrue('user', { method: 'GET', token: access_token });
  await setSession(
    toSession({ access_token, refresh_token, expires_in: Number(expires_in) || 3600 }, { id: user.id, email: user.email })
  );
}

function tokensFromUrl(url) {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const params = new URLSearchParams(hash || url.split('?')[1] || '');
  return {
    access: params.get('access_token'),
    refresh: params.get('refresh_token'),
    expires: params.get('expires_in'),
    error: params.get('error_description') || params.get('error'),
  };
}

// Google: the browser goes to Google and comes back with the tokens in the address (on phones through
// a browser sheet, on the web by redirecting the page itself).
export async function signInWithGoogle() {
  const redirect = WEB ? globalThis.location.origin : Linking.createURL('auth-callback');
  const url = `${URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
  if (WEB) {
    globalThis.location.assign(url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== 'success') return; // closed by the user
  const t = tokensFromUrl(result.url);
  if (t.error) throw new AuthFail(t.error);
  if (!t.access) throw new AuthFail('Google sign-in did not finish. Please try again.');
  await sessionFromTokens(t.access, t.refresh, t.expires);
}

export async function signOut() {
  const token = session?.access_token;
  await setSession(null);
  if (token) gotrue('logout', { token }).catch(() => {});
}

// ---- Tokens for the Langogo backend --------------------------------------------------
let refreshing = null;

export async function refreshSession() {
  if (!session?.refresh_token) return false;
  if (!refreshing) {
    refreshing = gotrue('token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } })
      .then(async (data) => {
        await setSession(toSession(data, session.user));
        return true;
      })
      .catch((e) => {
        // a network problem keeps the session; a refused refresh token means "sign in again"
        return e instanceof AuthFail && /reach/.test(e.message) ? true : false;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// The access token, renewed first when it is about to expire. null when signed out.
export async function getAccessToken() {
  if (!authEnabled || !session) return null;
  if (session.expires_at - Math.floor(Date.now() / 1000) < 60) {
    const ok = await refreshSession();
    if (!ok) {
      await setSession(null);
      return null;
    }
  }
  return session?.access_token ?? null;
}

// Call once when the app starts: restores the saved session, or finishes a Google sign-in on the web.
export async function initAuth() {
  if (!authEnabled) return;
  try {
    if (WEB && globalThis.location?.hash?.includes('access_token')) {
      const t = tokensFromUrl(globalThis.location.href);
      globalThis.history?.replaceState(null, '', globalThis.location.pathname);
      if (t.access) await sessionFromTokens(t.access, t.refresh, t.expires);
    } else {
      const saved = await readItem(SESSION_KEY);
      if (saved) session = JSON.parse(saved);
    }
    if (session) await getAccessToken(); // renews an old token, or signs out when it can't be renewed
  } catch (e) {
    session = null;
  }
  ready = true;
  emit();
}

// ---- "Research" choice made on the sign-up screen, sent to the backend after the first sign-in ----
export const setPendingConsent = (value) => writeItem(CONSENT_KEY, value ? 'true' : 'false');
export const getPendingConsent = async () => {
  const v = await readItem(CONSENT_KEY);
  return v == null ? null : v === 'true';
};
export const clearPendingConsent = () => writeItem(CONSENT_KEY, null);
