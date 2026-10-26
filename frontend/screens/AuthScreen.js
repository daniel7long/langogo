import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { clearPendingConsent, resetPassword, setPendingConsent, signIn, signInWithGoogle, signUp } from '../api/auth';
import Logo from '../components/Logo';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { notify } from '../utils/dialog';
import { colors, radius, shadows, spacing, typography } from '../theme';

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const open = (url) => url && Linking.openURL(url);

// Sign in or create an account: Google, or email + password. (Supabase does the actual sign-in.)
export default function AuthScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [research, setResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false); // "check your email" after sign-up

  const signup = mode === 'signup';
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = validEmail && password.length >= (signup ? 8 : 1) && (!signup || agree);

  const run = async (job) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (signup) {
        await setPendingConsent(research); // sent to the backend after the first sign-in
        try {
          const r = await signUp(email, password);
          if (r.needsConfirmation) setSent(true);
        } catch (e) {
          await clearPendingConsent();
          throw e;
        }
      } else {
        await signIn(email, password);
      }
    });

  const google = () =>
    run(async () => {
      if (signup && research) await setPendingConsent(true);
      await signInWithGoogle();
    });

  const forgot = () => {
    if (!validEmail) {
      setError('Enter your email above first, then tap "Forgot password?".');
      return;
    }
    run(async () => {
      await resetPassword(email);
      notify('Check your email', 'If an account exists for that address, a reset link is on its way.');
    });
  };

  if (sent) {
    return (
      <Screen>
        <View style={styles.sentWrap}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-outline" size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.sub}>
            We sent a confirmation link to {email.trim()}. Open it, then come back here and sign in.
          </Text>
          <PrimaryButton
            label="Back to sign in"
            onPress={() => {
              setSent(false);
              setMode('signin');
              setPassword('');
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Logo width={170} style={styles.logo} />
          <Text style={styles.title} accessibilityRole="header">{signup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.sub}>
            {signup ? 'Practise speaking with no pressure. Your progress is saved to your account.' : 'Sign in to pick up where you left off.'}
          </Text>

          <View style={styles.segment}>
            {[['signin', 'Sign in'], ['signup', 'Create account']].map(([id, label]) => {
              const on = mode === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => { setMode(id); setError(null); }}
                  style={[styles.seg, on && styles.segOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={google} disabled={busy} style={styles.google} accessibilityRole="button" accessibilityLabel="Continue with Google">
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.or}>
            <View style={styles.line} />
            <Text style={styles.orText}>or use your email</Text>
            <View style={styles.line} />
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            style={styles.input}
            accessibilityLabel="Email"
          />
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={signup ? 'Password (at least 8 characters)' : 'Password'}
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={signup ? 'new-password' : 'current-password'}
              textContentType={signup ? 'newPassword' : 'password'}
              onSubmitEditing={canSubmit ? submit : undefined}
              style={[styles.input, styles.passwordInput]}
              accessibilityLabel="Password"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={styles.eye} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {signup && (
            <View style={styles.checks}>
              <Check on={agree} onPress={() => setAgree((v) => !v)}>
                I agree to the{' '}
                <Text style={styles.link} onPress={() => open(TERMS_URL)}>Terms</Text> and{' '}
                <Text style={styles.link} onPress={() => open(PRIVACY_URL)}>Privacy Policy</Text>.
              </Check>
              <Check on={research} onPress={() => setResearch((v) => !v)}>
                Optional: let researchers use my speaking data, stored without my name or email, to study how people learn to speak.
                I can change this any time in Settings.
              </Check>
            </View>
          )}

          {!!error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle-outline" size={18} color="#A8392E" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <PrimaryButton label={signup ? 'Create account' : 'Sign in'} onPress={submit} disabled={!canSubmit} loading={busy} />
          {!signup && (
            <Pressable onPress={forgot} hitSlop={8} style={styles.forgot} accessibilityRole="button">
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Check({ on, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <View style={[styles.box, on && styles.boxOn]}>{on && <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}</View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  logo: { marginTop: spacing.md },
  title: { ...typography.headline, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: 4, borderWidth: 1, borderColor: colors.line },
  seg: { flex: 1, alignItems: 'center', paddingVertical: spacing.s12, borderRadius: radius.full },
  segOn: { backgroundColor: colors.primary },
  segText: { ...typography.label, color: colors.textMuted },
  segTextOn: { color: colors.onPrimary },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s12, minHeight: 54, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, ...shadows.card() },
  googleText: { ...typography.button, color: colors.text },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { ...typography.caption, color: colors.textFaint },
  input: { ...typography.body, color: colors.text, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52 },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: spacing.md },
  checks: { gap: spacing.s12 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginTop: 1 },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { ...typography.labelSm, color: colors.textMuted, flex: 1, lineHeight: 18 },
  link: { ...typography.labelSm, color: colors.primary },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.coralBg, borderRadius: radius.md, padding: spacing.s12 },
  errorText: { ...typography.labelSm, color: '#A8392E', flex: 1, lineHeight: 18 },
  forgot: { alignSelf: 'center' },
  sentWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  sentIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
});
