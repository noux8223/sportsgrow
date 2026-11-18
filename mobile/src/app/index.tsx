import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

export default function IndexScreen() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'signed_in') router.replace('/home');
    if (status === 'signed_out') router.replace('/login');
  }, [status]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.hint}>세션을 확인하는 중입니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
  },
});
