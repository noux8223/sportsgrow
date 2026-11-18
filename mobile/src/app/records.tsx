import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SessionGate } from '../components/SessionGate';
import {
  Body,
  Card,
  ErrorText,
  FieldLabel,
  Muted,
  PrimaryButton,
  Screen,
  SectionTitle,
  SelectableChip,
  TextField,
} from '../components/ui';
import {
  apiErrorMessage,
  createGame,
  createTraining,
  fetchGames,
  fetchTraining,
  type GameRecord,
  type TrainingRecord,
} from '../lib/api';
import { MEMBERSHIP_CHOICE_MESSAGE, useAthleteScope } from '../lib/athletes';
import { formatIsoDate, toDateInput } from '../lib/date';
import { colors, spacing } from '../lib/theme';

const INTENSITY_OPTIONS = [
  { value: 'low', label: '하' },
  { value: 'mid', label: '중' },
  { value: 'high', label: '상' },
] as const;

const INTENSITY_LABELS: Record<string, string> = { low: '하', mid: '중', high: '상' };

export default function RecordsScreen() {
  return (
    <SessionGate>
      <RecordsContent />
    </SessionGate>
  );
}

function RecordsContent() {
  const scope = useAthleteScope();
  const { token, membership, athletes, selected, status, error } = scope;

  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reloadRecords = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!token || !selected) {
      setTraining([]);
      setGames([]);
      setTrainingError(null);
      setGamesError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const [trainingResult, gamesResult] = await Promise.allSettled([
        fetchTraining(token, selected.id),
        fetchGames(token, selected.id),
      ]);
      if (cancelled) return;
      if (trainingResult.status === 'fulfilled') {
        setTraining(trainingResult.value);
        setTrainingError(null);
      } else {
        setTraining([]);
        setTrainingError(apiErrorMessage(trainingResult.reason, '훈련 기록을 불러오지 못했습니다.'));
      }
      if (gamesResult.status === 'fulfilled') {
        setGames(gamesResult.value);
        setGamesError(null);
      } else {
        setGames([]);
        setGamesError(apiErrorMessage(gamesResult.reason, '경기 기록을 불러오지 못했습니다.'));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, selected, reloadKey]);

  const role = membership?.role;
  const canWrite = useMemo(() => {
    if (!selected || !role || selected.status !== 'active') return false;
    return selected.hasAthleteUser ? role === 'athlete' : role === 'coach';
  }, [role, selected]);

  return (
    <Screen>
      {status === 'loading' ? (
        <Card>
          <Muted>선수 정보를 불러오는 중입니다.</Muted>
        </Card>
      ) : null}

      {status === 'choose' ? (
        <Card>
          <SectionTitle>기록</SectionTitle>
          <Muted>{MEMBERSHIP_CHOICE_MESSAGE}</Muted>
        </Card>
      ) : null}

      {status === 'error' && error ? (
        <Card>
          <SectionTitle>기록</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      {status === 'ready' && athletes.length === 0 ? (
        <Card>
          <SectionTitle>기록</SectionTitle>
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
            {selected.status !== 'active' ? (
              <Muted>활성화가 완료되면 훈련과 경기 기록을 저장할 수 있습니다.</Muted>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>훈련 기록</SectionTitle>
            {loading ? <Muted>불러오는 중입니다.</Muted> : null}
            {trainingError ? <ErrorText>{trainingError}</ErrorText> : null}
            {!loading && !trainingError && training.length === 0 ? (
              <Muted>훈련 기록이 없습니다.</Muted>
            ) : null}
            {training.map((row) => (
              <View key={row.id} style={styles.record}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordTitle}>{row.type}</Text>
                  <Muted>{formatIsoDate(row.trained_on)}</Muted>
                </View>
                <Body>
                  {row.minutes}분 · 강도 {INTENSITY_LABELS[row.intensity] ?? row.intensity}
                </Body>
                {row.memo ? <Muted>{row.memo}</Muted> : null}
              </View>
            ))}
          </Card>

          {canWrite && token ? (
            <TrainingForm token={token} athleteId={selected.id} onSaved={reloadRecords} />
          ) : null}

          <Card>
            <SectionTitle>경기 기록</SectionTitle>
            {loading ? <Muted>불러오는 중입니다.</Muted> : null}
            {gamesError ? <ErrorText>{gamesError}</ErrorText> : null}
            {!loading && !gamesError && games.length === 0 ? (
              <Muted>경기 기록이 없습니다.</Muted>
            ) : null}
            {games.map((row) => (
              <View key={row.id} style={styles.record}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordTitle}>
                    {row.opponent ? `vs ${row.opponent}` : '상대 미기록'}
                  </Text>
                  <Muted>{formatIsoDate(row.played_on)}</Muted>
                </View>
                <Body>
                  {row.at_bats}타수 {row.hits}안타 {row.walks}볼넷
                </Body>
                {row.competition ? <Muted>{row.competition}</Muted> : null}
              </View>
            ))}
          </Card>

          {canWrite && token ? (
            <GameForm token={token} athleteId={selected.id} onSaved={reloadRecords} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function TrainingForm({
  token,
  athleteId,
  onSaved,
}: {
  token: string;
  athleteId: string;
  onSaved: () => void;
}) {
  const today = useMemo(() => toDateInput(new Date()), []);
  const [trainedOn, setTrainedOn] = useState(today);
  const [type, setType] = useState('');
  const [minutes, setMinutes] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'mid' | 'high'>('mid');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsedMinutes = Number(minutes);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trainedOn)) {
      setError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    if (!type.trim()) {
      setError('훈련 종류를 입력해 주세요.');
      return;
    }
    if (!Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
      setError('훈련 시간은 1분 이상 1440분 이하로 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createTraining(token, athleteId, {
        trainedOn,
        type: type.trim(),
        minutes: parsedMinutes,
        intensity,
        memo: memo.trim(),
      });
      setType('');
      setMinutes('');
      setMemo('');
      setIntensity('mid');
      onSaved();
    } catch (saveError) {
      setError(apiErrorMessage(saveError, '훈련 기록을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>훈련 기록 추가</SectionTitle>

      <FieldLabel>날짜</FieldLabel>
      <TextField value={trainedOn} onChangeText={setTrainedOn} placeholder="YYYY-MM-DD" autoCapitalize="none" />

      <FieldLabel>훈련 종류</FieldLabel>
      <TextField value={type} onChangeText={setType} placeholder="예: 타격, 수비" />

      <FieldLabel>시간(분)</FieldLabel>
      <TextField
        value={minutes}
        onChangeText={setMinutes}
        placeholder="1 ~ 1440"
        keyboardType="number-pad"
      />

      <FieldLabel>강도</FieldLabel>
      <View style={styles.chips}>
        {INTENSITY_OPTIONS.map((option) => (
          <SelectableChip
            key={option.value}
            label={option.label}
            selected={intensity === option.value}
            onPress={() => setIntensity(option.value)}
          />
        ))}
      </View>

      <FieldLabel>메모</FieldLabel>
      <TextField
        value={memo}
        onChangeText={setMemo}
        placeholder="선택 입력"
        multiline
        style={styles.multiline}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label="훈련 저장" onPress={handleSave} busy={saving} />
    </Card>
  );
}

function GameForm({
  token,
  athleteId,
  onSaved,
}: {
  token: string;
  athleteId: string;
  onSaved: () => void;
}) {
  const today = useMemo(() => toDateInput(new Date()), []);
  const [playedOn, setPlayedOn] = useState(today);
  const [competition, setCompetition] = useState('');
  const [opponent, setOpponent] = useState('');
  const [atBats, setAtBats] = useState('0');
  const [hits, setHits] = useState('0');
  const [walks, setWalks] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsedAtBats = Number(atBats);
    const parsedHits = Number(hits);
    const parsedWalks = Number(walks);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) {
      setError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    if (![parsedAtBats, parsedHits, parsedWalks].every((value) => Number.isInteger(value) && value >= 0)) {
      setError('타수, 안타, 볼넷은 0 이상의 정수로 입력해 주세요.');
      return;
    }
    if (parsedHits > parsedAtBats) {
      setError('안타는 타수보다 많을 수 없습니다.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createGame(token, athleteId, {
        playedOn,
        competition: competition.trim(),
        opponent: opponent.trim(),
        atBats: parsedAtBats,
        hits: parsedHits,
        walks: parsedWalks,
      });
      setCompetition('');
      setOpponent('');
      setAtBats('0');
      setHits('0');
      setWalks('0');
      onSaved();
    } catch (saveError) {
      setError(apiErrorMessage(saveError, '경기 기록을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>경기 기록 추가</SectionTitle>

      <FieldLabel>날짜</FieldLabel>
      <TextField value={playedOn} onChangeText={setPlayedOn} placeholder="YYYY-MM-DD" autoCapitalize="none" />

      <FieldLabel>대회</FieldLabel>
      <TextField value={competition} onChangeText={setCompetition} placeholder="선택 입력" />

      <FieldLabel>상대</FieldLabel>
      <TextField value={opponent} onChangeText={setOpponent} placeholder="선택 입력" />

      <FieldLabel>타수</FieldLabel>
      <TextField value={atBats} onChangeText={setAtBats} keyboardType="number-pad" />

      <FieldLabel>안타</FieldLabel>
      <TextField value={hits} onChangeText={setHits} keyboardType="number-pad" />

      <FieldLabel>볼넷</FieldLabel>
      <TextField value={walks} onChangeText={setWalks} keyboardType="number-pad" />

      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label="경기 저장" onPress={handleSave} busy={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  record: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recordTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
