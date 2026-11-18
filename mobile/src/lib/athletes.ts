import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiErrorMessage, fetchOrgAthletes, type AthleteSummary, type Membership } from './api';
import { readSessionToken } from './secure-session';
import { useSession } from './session';

export type AthleteScopeStatus = 'loading' | 'ready' | 'choose' | 'error';

export type AthleteScope = {
  status: AthleteScopeStatus;
  error: string | null;
  membership: Membership | null;
  token: string | null;
  athletes: AthleteSummary[];
  selected: AthleteSummary | null;
  select: (athleteId: string) => void;
};

export const MEMBERSHIP_CHOICE_MESSAGE = '소속을 선택해 주세요.';

export function useAthleteScope(): AthleteScope {
  const { session } = useSession();

  const membership = useMemo(() => {
    if (!session) return null;
    return session.memberships.find((item) => item.id === session.activeMembershipId) ?? null;
  }, [session]);

  const needsChoice = session !== null && membership === null && session.memberships.length > 0;

  const [token, setToken] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<AthleteScopeStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!membership) {
      setToken(null);
      setAthletes([]);
      setSelectedId(null);
      setStatus(needsChoice ? 'choose' : 'ready');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    (async () => {
      const stored = await readSessionToken();
      if (cancelled) return;
      if (!stored) {
        setToken(null);
        setAthletes([]);
        setSelectedId(null);
        setStatus('error');
        setError('로그인이 필요합니다.');
        return;
      }

      setToken(stored);
      try {
        const payload = await fetchOrgAthletes(stored, membership.orgId);
        if (cancelled) return;
        const list = Array.isArray(payload.athletes) ? payload.athletes : [];
        setAthletes(list);
        setSelectedId((previous) =>
          previous && list.some((athlete) => athlete.id === previous)
            ? previous
            : list[0]?.id ?? null,
        );
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setAthletes([]);
        setSelectedId(null);
        setStatus('error');
        setError(apiErrorMessage(loadError, '선수 목록을 불러오지 못했습니다.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [membership, needsChoice]);

  const select = useCallback((athleteId: string) => setSelectedId(athleteId), []);

  const selected = useMemo(
    () => athletes.find((athlete) => athlete.id === selectedId) ?? null,
    [athletes, selectedId],
  );

  return { status, error, membership, token, athletes, selected, select };
}
