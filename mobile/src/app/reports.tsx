import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SessionGate } from '../components/SessionGate';
import {
  Body,
  Card,
  ErrorText,
  Muted,
  Screen,
  SectionTitle,
  SelectableChip,
} from '../components/ui';
import {
  apiErrorMessage,
  fetchCoachNotes,
  fetchWeeklyReports,
  type CoachNote,
  type WeeklyReport,
} from '../lib/api';
import { useAthleteScope, MEMBERSHIP_CHOICE_MESSAGE } from '../lib/athletes';
import { formatDate, formatIsoDate, formatTimestamp, weekRangeLabel } from '../lib/date';
import { colors, spacing } from '../lib/theme';

export default function ReportsScreen() {
  return (
    <SessionGate>
      <ReportsContent />
    </SessionGate>
  );
}

function ReportsContent() {
  const scope = useAthleteScope();
  const { token, athletes, selected, status, error } = scope;
  const today = useMemo(() => new Date(), []);

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    if (!token || !selected) {
      setReports([]);
      setReportsError(null);
      setReportsLoading(false);
      setNotes([]);
      setNotesError(null);
      setNotesLoading(false);
      return;
    }

    let cancelled = false;
    setReportsLoading(true);
    setReportsError(null);
    setNotesLoading(true);
    setNotesError(null);

    (async () => {
      const [reportsResult, notesResult] = await Promise.allSettled([
        fetchWeeklyReports(token, selected.id),
        fetchCoachNotes(token, selected.id),
      ]);
      if (cancelled) return;

      if (reportsResult.status === 'fulfilled') {
        setReports(reportsResult.value);
        setReportsError(null);
      } else {
        setReports([]);
        setReportsError(apiErrorMessage(reportsResult.reason, '주간 리포트를 불러오지 못했습니다.'));
      }
      setReportsLoading(false);

      if (notesResult.status === 'fulfilled') {
        setNotes(notesResult.value);
        setNotesError(null);
      } else {
        setNotes([]);
        setNotesError(apiErrorMessage(notesResult.reason, '코치 메모를 불러오지 못했습니다.'));
      }
      setNotesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, selected]);

  return (
    <Screen>
      <Card>
        <SectionTitle>이번 주 리포트</SectionTitle>
        <Body>{weekRangeLabel(today)}</Body>
        <Muted>기준일 {formatDate(today)}</Muted>
      </Card>

      {status === 'loading' ? (
        <Card>
          <Muted>선수 정보를 불러오는 중입니다.</Muted>
        </Card>
      ) : null}

      {status === 'choose' ? (
        <Card>
          <Muted>{MEMBERSHIP_CHOICE_MESSAGE}</Muted>
        </Card>
      ) : null}

      {status === 'error' && error ? (
        <Card>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      {status === 'ready' && athletes.length === 0 ? (
        <Card>
          <Muted>담당 선수가 없습니다.</Muted>
        </Card>
      ) : null}

      {athletes.length > 1 ? (
        <Card>
          <SectionTitle>선수 선택</SectionTitle>
          <View style={styles.chips}>
            {athletes.map((athlete) => (
              <SelectableChip
                key={athlete.id}
                label={athlete.displayName}
                selected={athlete.id === selected?.id}
                onPress={() => scope.select(athlete.id)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {selected ? (
        <>
          <Card>
            <SectionTitle>{selected.displayName}</SectionTitle>
            {selected.teamName ? <Muted>{selected.teamName}</Muted> : null}
          </Card>

          <Card>
            <SectionTitle>주간 리포트</SectionTitle>
            {reportsLoading ? <Muted>불러오는 중입니다.</Muted> : null}
            {reportsError ? <ErrorText>{reportsError}</ErrorText> : null}
            {!reportsLoading && !reportsError && reports.length === 0 ? (
              <Muted>주간 리포트가 아직 없습니다.</Muted>
            ) : null}
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </Card>

          <Card>
            <SectionTitle>코치 메모</SectionTitle>
            {notesLoading ? <Muted>불러오는 중입니다.</Muted> : null}
            {notesError ? <ErrorText>{notesError}</ErrorText> : null}
            {!notesLoading && !notesError && notes.length === 0 ? (
              <Muted>코치 메모가 아직 없습니다.</Muted>
            ) : null}
            {notes.map((note) => (
              <View key={note.id} style={styles.note}>
                <Muted>{formatTimestamp(note.created_at)}</Muted>
                <Body>{note.body}</Body>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Muted>주간 리포트 수신 여부는 보호자가 관리합니다.</Muted>
    </Screen>
  );
}

function ReportCard({ report }: { report: WeeklyReport }) {
  const body = report.body_json ?? {};

  const trainingParts: string[] = [];
  if (typeof body.trainingDays === 'number') trainingParts.push(`${body.trainingDays}일`);
  if (typeof body.trainingMinutes === 'number') trainingParts.push(`${body.trainingMinutes}분`);

  const gameParts: string[] = [];
  if (typeof body.games === 'number') gameParts.push(`${body.games}경기`);
  if (typeof body.atBats === 'number') gameParts.push(`${body.atBats}타수`);
  if (typeof body.hits === 'number') gameParts.push(`${body.hits}안타`);
  if (typeof body.weekBattingAverage === 'number') {
    gameParts.push(`타율 ${body.weekBattingAverage.toFixed(3)}`);
  }

  const goals = Array.isArray(body.goals) ? body.goals : [];

  return (
    <View style={styles.report}>
      <Text style={styles.reportWeek}>
        {report.week_start ? `${formatIsoDate(report.week_start)} 주` : '주간 리포트'}
      </Text>
      {body.athleteName ? <Muted>{body.athleteName}</Muted> : null}
      {trainingParts.length > 0 ? <Body>훈련 {trainingParts.join(' · ')}</Body> : null}
      {gameParts.length > 0 ? <Body>경기 {gameParts.join(' · ')}</Body> : null}
      {goals.length > 0 ? (
        <View style={styles.goals}>
          <Muted>목표</Muted>
          {goals.map((goal, index) => (
            <Body key={`${goal.metric}-${index}`}>
              {goal.title} ({goal.target_numeric})
            </Body>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  report: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  reportWeek: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  goals: {
    gap: 2,
  },
  note: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
});
