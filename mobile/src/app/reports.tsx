import { useMemo } from 'react';

import { SessionGate } from '../components/SessionGate';
import { Body, Card, Muted, Screen, SectionTitle } from '../components/ui';
import { formatDate, weekRangeLabel } from '../lib/date';

export default function ReportsScreen() {
  const today = useMemo(() => new Date(), []);

  return (
    <SessionGate>
      <Screen>
        <Card>
          <SectionTitle>이번 주 리포트</SectionTitle>
          <Body>{weekRangeLabel(today)}</Body>
          <Muted>기준일 {formatDate(today)}</Muted>
        </Card>

        <Card>
          <SectionTitle>훈련 요약</SectionTitle>
          <Muted>이번 주 훈련 요약이 아직 없습니다.</Muted>
        </Card>

        <Card>
          <SectionTitle>경기 요약</SectionTitle>
          <Muted>이번 주 경기 요약이 아직 없습니다.</Muted>
        </Card>

        <Card>
          <SectionTitle>코치 메모</SectionTitle>
          <Muted>코치 메모가 아직 없습니다.</Muted>
        </Card>

        <Muted>주간 리포트 수신 여부는 보호자가 관리합니다.</Muted>
      </Screen>
    </SessionGate>
  );
}
