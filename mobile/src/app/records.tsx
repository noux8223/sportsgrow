import { useMemo } from 'react';

import { SessionGate } from '../components/SessionGate';
import { Body, Card, Muted, Screen, SectionTitle } from '../components/ui';
import { formatDate } from '../lib/date';

export default function RecordsScreen() {
  const today = useMemo(() => new Date(), []);

  return (
    <SessionGate>
      <Screen>
        <Card>
          <SectionTitle>오늘</SectionTitle>
          <Body>{formatDate(today)}</Body>
          <Muted>훈련 기록과 경기 기록을 조회하는 화면입니다.</Muted>
        </Card>

        <Card>
          <SectionTitle>훈련 기록</SectionTitle>
          <Muted>아직 불러온 훈련 기록이 없습니다.</Muted>
        </Card>

        <Card>
          <SectionTitle>경기 기록</SectionTitle>
          <Muted>아직 불러온 경기 기록이 없습니다.</Muted>
        </Card>
      </Screen>
    </SessionGate>
  );
}
