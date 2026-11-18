import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

export function SessionGate({ children }: { children: ReactNode }) {
  const { status, message } = useSession();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.hint}>세션을 확인하는 중입니다.</Text>
      </View>
    );
  }

  if (status === 'signed_out') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>로그인이 필요합니다</Text>
        <Text style={styles.hint}>{message ?? '계속하려면 로그인해 주세요.'}</Text>
        <Link href="/login" style={styles.link}>
          로그인 화면으로
        </Link>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.muted,
  },
  link: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
});
