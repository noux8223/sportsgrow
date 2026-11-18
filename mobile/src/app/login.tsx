import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card, Muted, Screen, SectionTitle } from '../components/ui';
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

export default function LoginScreen() {
  const { signIn, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'signed_in') router.replace('/home');
  }, [status]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (result.ok) {
      router.replace('/home');
      return;
    }
    setError(result.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Card>
          <SectionTitle>Sports Grow 로그인</SectionTitle>
          <Muted>학생, 학부모, 코치, 기관 관리자 계정으로 로그인합니다.</Muted>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            editable={!busy}
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
            editable={!busy}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.button,
              !canSubmit ? styles.buttonDisabled : null,
              pressed && canSubmit ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.buttonText}>{busy ? '로그인 중...' : '로그인'}</Text>
          </Pressable>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  error: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentText,
  },
});
