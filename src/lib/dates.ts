export interface Duration {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface TotalDuration {
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  totalWeeks: number;
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  // month is 1-indexed
  return new Date(year, month, 0).getDate();
}

/**
 * Precise calendar-based difference between two dates.
 * Computes years/months/days by walking the calendar (handles leap years),
 * plus hours/minutes/seconds from the remainder of the day.
 */
export function preciseDiff(from: Date, to: Date): Duration {
  // Ensure from <= to; if reversed, swap and we'll negate day math conceptually
  let f = new Date(from);
  let t = new Date(to);
  let negative = false;
  if (f > t) {
    const tmp = f;
    f = t;
    t = tmp;
    negative = true;
  }

  let years = t.getFullYear() - f.getFullYear();
  let months = t.getMonth() - f.getMonth();
  let days = t.getDate() - f.getDate();
  let hours = t.getHours() - f.getHours();
  let minutes = t.getMinutes() - f.getMinutes();
  let seconds = t.getSeconds() - f.getSeconds();

  // Normalize seconds
  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  // Normalize minutes
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  // Normalize hours
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  // Normalize days
  if (days < 0) {
    // borrow from previous month relative to target month/year
    const prevMonthYear = t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear();
    const prevMonth = t.getMonth() === 0 ? 12 : t.getMonth();
    days += daysInMonth(prevMonthYear, prevMonth);
    months -= 1;
  }
  // Normalize months
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  if (negative) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return { years, months, days, hours, minutes, seconds };
}

export function totalDiff(from: Date, to: Date): TotalDuration {
  const ms = Math.max(0, to.getTime() - from.getTime());
  return {
    totalSeconds: Math.floor(ms / MS_PER_SECOND),
    totalMinutes: Math.floor(ms / MS_PER_MINUTE),
    totalHours: Math.floor(ms / MS_PER_HOUR),
    totalDays: Math.floor(ms / MS_PER_DAY),
    totalWeeks: Math.floor(ms / (MS_PER_DAY * 7)),
  };
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function isValidDate(d: Date | null): d is Date {
  return d !== null && !isNaN(d.getTime());
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function toDateInputValue(d: Date): string {
  // YYYY-MM-DD for <input type="date">
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function toDateTimeInputValue(d: Date): string {
  // YYYY-MM-DDTHH:mm for <input type="datetime-local">
  return `${toDateInputValue(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
