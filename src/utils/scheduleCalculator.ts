import { ScheduleDuration } from '../types';

/**
 * Normalizes any schedule time representation (string, object with time24/time/displayTime, etc.)
 * into a standard "HH:MM" 24-hour string format.
 */
export function normalizeTime(timeInput: any): string {
  if (!timeInput) return '08:00';
  if (typeof timeInput === 'string') {
    const trimmed = timeInput.trim();
    // If it's already HH:MM or H:MM
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    // If it's 12-hour format e.g. "8:00 AM" or "01:30 PM"
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2];
      const meridiem = match12[3].toLowerCase();
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    return trimmed;
  }
  if (typeof timeInput === 'object') {
    if (typeof timeInput.time24 === 'string') return normalizeTime(timeInput.time24);
    if (typeof timeInput.time === 'string') return normalizeTime(timeInput.time);
    if (typeof timeInput.time12Formatted === 'string') return normalizeTime(timeInput.time12Formatted);
    if (typeof timeInput.displayTime === 'string') return normalizeTime(timeInput.displayTime);
    if (typeof timeInput.hour === 'number' && typeof timeInput.minute === 'number') {
      return `${String(timeInput.hour).padStart(2, '0')}:${String(timeInput.minute).padStart(2, '0')}`;
    }
    if (typeof timeInput.hours === 'number' && typeof timeInput.minutes === 'number') {
      return `${String(timeInput.hours).padStart(2, '0')}:${String(timeInput.minutes).padStart(2, '0')}`;
    }
  }
  return '08:00';
}

/**
 * Formats any time representation into user-friendly "H:MM AM/PM" text.
 * Guarantees never returning "[object Object]".
 */
export function formatScheduleTime(timeInput: any): string {
  if (!timeInput) return '8:00 AM';
  if (typeof timeInput === 'object') {
    if (typeof timeInput.displayTime === 'string' && timeInput.displayTime.trim()) {
      return timeInput.displayTime.trim();
    }
    if (typeof timeInput.time12Formatted === 'string' && timeInput.time12Formatted.trim()) {
      return timeInput.time12Formatted.trim();
    }
  }
  const norm = normalizeTime(timeInput);
  if (typeof norm !== 'string') return '8:00 AM';
  if (/am|pm/i.test(norm)) return norm;
  const parts = norm.split(':');
  if (parts.length < 2) return norm;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return norm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function checkIsDateTimePast(dateStr: any, timeStr?: any): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  let hours = 23;
  let mins = 59;
  const cleanTime = timeStr ? normalizeTime(timeStr) : null;
  if (cleanTime && typeof cleanTime === 'string' && cleanTime.includes(':')) {
    const timeParts = cleanTime.split(':');
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
  startDateStr: any,
  duration: ScheduleDuration,
  customEndDateStr?: any,
  selectedDays?: string[],
  timeStr?: any
): string[] {
  const normStart = typeof startDateStr === 'string' ? startDateStr : (startDateStr ? String(startDateStr) : '');
  if (!normStart || typeof normStart !== 'string') return [];

  const parts = normStart.split('-');
  if (parts.length !== 3) return [normStart];

  const startYear = parseInt(parts[0], 10);
  const startMonth = parseInt(parts[1], 10) - 1;
  const startDay = parseInt(parts[2], 10);

  const start = new Date(startYear, startMonth, startDay);
  if (isNaN(start.getTime())) return [normStart];

  let totalDays = 7;
  if (duration === 'today_only') totalDays = 1;
  else if (duration === '1_week') totalDays = 7;
  else if (duration === '1_month') totalDays = 30;
  else if (duration === '3_months') totalDays = 90;
  else if (duration === 'indefinite') totalDays = 30;
  else if (duration === 'custom' && customEndDateStr && typeof customEndDateStr === 'string') {
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
  const activeDays = (selectedDays && Array.isArray(selectedDays) && selectedDays.length > 0)
    ? selectedDays.map(d => typeof d === 'string' ? d.trim().substring(0, 3).toLowerCase() : '').filter(Boolean)
    : null;

  const dates: string[] = [];
  const current = new Date(start);
  const normTime = timeStr ? normalizeTime(timeStr) : undefined;

  for (let i = 0; i < totalDays; i++) {
    const dayStr = dayNameMap[current.getDay()].toLowerCase();
    if (!activeDays || activeDays.length === 0 || activeDays.includes(dayStr)) {
      const formatted = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      if (!normTime || !checkIsDateTimePast(formatted, normTime)) {
        dates.push(formatted);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function calculateScheduleOccurrences(
  startDateStr: any,
  duration: ScheduleDuration,
  customEndDateStr?: any,
  selectedDays?: string[],
  timeStr?: any
): number {
  const dates = calculateScheduleDatesList(startDateStr, duration, customEndDateStr, selectedDays, timeStr);
  return dates.length;
}
