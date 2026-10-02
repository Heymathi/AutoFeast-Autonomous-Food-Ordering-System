import { ScheduleDuration } from '../types';

export function checkIsDateTimePast(dateStr: string, timeStr?: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  let hours = 23;
  let mins = 59;
  if (timeStr && timeStr.trim()) {
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
      const h = parseInt(timeParts[0], 10);
      const m = parseInt(timeParts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        hours = h;
        mins = m;
      }
    }
  }

  const target = new Date(year, month, day, hours, mins, 0, 0);
  return target.getTime() < Date.now();
}

export function getNextAvailableTimeSlot(): string {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 60 * 1000);
  const minutes = future.getMinutes();
  if (minutes > 0 && minutes < 30) {
    future.setMinutes(30, 0, 0);
  } else if (minutes > 30) {
    future.setHours(future.getHours() + 1, 0, 0, 0);
  } else {
    future.setMinutes(minutes === 0 ? 0 : 30, 0, 0);
  }
  const h = String(future.getHours()).padStart(2, '0');
  const m = String(future.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function calculateScheduleDatesList(
  startDateStr: string,
  duration: ScheduleDuration,
  customEndDateStr?: string,
  selectedDays?: string[],
  timeStr?: string
): string[] {
  if (!startDateStr) return [];

  const parts = startDateStr.split('-');
  if (parts.length !== 3) return [startDateStr];

  const startYear = parseInt(parts[0], 10);
  const startMonth = parseInt(parts[1], 10) - 1;
  const startDay = parseInt(parts[2], 10);

  const start = new Date(startYear, startMonth, startDay);
  if (isNaN(start.getTime())) return [startDateStr];

  let totalDays = 7;
  if (duration === 'today_only') totalDays = 1;
  else if (duration === '1_week') totalDays = 7;
  else if (duration === '1_month') totalDays = 30;
  else if (duration === '3_months') totalDays = 90;
  else if (duration === 'indefinite') totalDays = 30;
  else if (duration === 'custom' && customEndDateStr) {
    const endParts = customEndDateStr.split('-');
    if (endParts.length === 3) {
      const endD = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
      if (!isNaN(endD.getTime())) {
        const diffTime = Math.max(0, endD.getTime() - start.getTime());
        totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
      }
    }
  }

  const dayNameMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = (selectedDays && selectedDays.length > 0)
    ? selectedDays.map(d => d.trim().substring(0, 3).toLowerCase())
    : null;

  const dates: string[] = [];
  const current = new Date(start);

  for (let i = 0; i < totalDays; i++) {
    const dayStr = dayNameMap[current.getDay()].toLowerCase();
    if (!activeDays || activeDays.length === 0 || activeDays.includes(dayStr)) {
      const formatted = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      if (!timeStr || !checkIsDateTimePast(formatted, timeStr)) {
        dates.push(formatted);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function calculateScheduleOccurrences(
  startDateStr: string,
  duration: ScheduleDuration,
  customEndDateStr?: string,
  selectedDays?: string[],
  timeStr?: string
): number {
  const dates = calculateScheduleDatesList(startDateStr, duration, customEndDateStr, selectedDays, timeStr);
  return dates.length;
}


