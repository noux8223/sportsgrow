import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SessionGate } from '../components/SessionGate';
import { Body, Card, ErrorText, Muted, Screen, SectionTitle } from '../components/ui';
import { apiErrorMessage, roleLabel, type Membership } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

export default function HomeScreen() {
  return (
    <SessionGate>
      <HomeContent />
    </SessionGate>
  );
}

function HomeContent() {
  const { session, message, signOut, selectMembership } = useSession();
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [choicePending, setChoicePending] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  async function handleChoose(membershipId: string) {
    setChoiceError(null);
    setChoicePending(true);
    try {
      await selectMembership(membershipId);
    } catch (error) {
      setChoiceError(apiErrorMessage(error, '소속을 선택하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setChoicePending(false);
    }
  }

  if (!session) return null;

  const { user, memberships, activeMembershipId } = session;
  const needsChoice = memberships.length > 1 && !activeMembershipId;
  const switchable = memberships.length > 1;

  return (
    <Screen>
      <Card>
        <Muted>로그인한 사용자</Muted>
        <Text style={styles.name}>{user.name}</Text>
        <Body>{user.email}</Body>
        {user.platformStaff ? <Text style={styles.badge}>운영자</Text> : null}
      </Card>

      <Card>
        <SectionTitle>소속과 역할</SectionTitle>
        {needsChoice ? (
          <Muted>여러 소속에 속해 있습니다. 사용할 소속을 선택해 주세요.</Muted>
        ) : null}
        {message ? <ErrorText>{message}</ErrorText> : null}
        {memberships.length === 0 ? (
          <Muted>등록된 소속이 없습니다.</Muted>
        ) : (
          memberships.map((membership) => {
            const active = membership.id === activeMembershipId;
            return (
              <MembershipRow
                key={membership.id}
                membership={membership}
                active={active}
                selectable={!active && (switchable || (memberships.length === 1 && !activeMembershipId))}
                selectLabel={activeMembershipId ? '눌러서 전환' : '눌러서 선택'}
                pending={choicePending}
                onChoose={handleChoose}
              />
            );
          })
        )}
        {choiceError ? <ErrorText>{choiceError}</ErrorText> : null}
      </Card>

      <Link href="/records" asChild>
        <Pressable style={({ pressed }) => [styles.nav, pressed ? styles.navPressed : null]}>
          <Text style={styles.navTitle}>기록</Text>
          <Muted>훈련 기록과 경기 기록 보기</Muted>
        </Pressable>
      </Link>

      <Link href="/reports" asChild>
        <Pressable style={({ pressed }) => [styles.nav, pressed ? styles.navPressed : null]}>
          <Text style={styles.navTitle}>리포트</Text>
          <Muted>주간 훈련·경기 리포트 보기</Muted>
        </Pressable>
      </Link>

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.logout, pressed ? styles.navPressed : null]}
      >
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </Screen>
  );
}

function MembershipRow({
  membership,
  active,
  selectable,
  selectLabel,
  pending,
  onChoose,
}: {
  membership: Membership;
  active: boolean;
  selectable: boolean;
  selectLabel: string;
  pending: boolean;
  onChoose: (membershipId: string) => void;
}) {
  const body = (
    <>
      <View style={styles.membershipHeader}>
        <Text style={styles.orgName}>{membership.orgName}</Text>
        {active ? <Text style={styles.activeTag}>선택된 소속</Text> : null}
        {selectable ? <Text style={styles.activeTag}>{selectLabel}</Text> : null}
      </View>
      <Text style={styles.role}>{roleLabel(membership.role)}</Text>
      {membership.athleteIds.length > 0 ? (
        <Muted>선수 {membership.athleteIds.length}명</Muted>
      ) : null}
    </>
  );

  if (!selectable) {
    return <View style={styles.membership}>{body}</View>;
  }

  return (
    <Pressable
      onPress={() => onChoose(membership.id)}
      disabled={pending}
      style={({ pressed }) => [
        styles.membership,
        styles.membershipSelectable,
        pending ? styles.membershipPending : null,
        pressed ? styles.navPressed : null,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.control,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    backgroundColor: colors.badge,
  },
  membership: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  membershipSelectable: {
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
  },
  membershipPending: {
    opacity: 0.5,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  orgName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  activeTag: {
    fontSize: 12,
    color: colors.muted,
  },
  role: {
    fontSize: 14,
    color: colors.muted,
  },
  nav: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  navPressed: {
    opacity: 0.85,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  logout: {
    marginTop: spacing.sm,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
  },
});
