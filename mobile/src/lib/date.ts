export function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function endOfWeek(date: Date): Date {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return end;
}

export function weekRangeLabel(date: Date): string {
  return `${formatShortDate(startOfWeek(date))} ~ ${formatShortDate(endOfWeek(date))}`;
}
