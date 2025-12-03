import { ensureAccessToken } from './auth';
import type { CalendarEvent, CalendarListResponse } from '@/types/calendar';

export function getYearRangeUTC(year: number) {
  const timeMin = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
  return { timeMin, timeMax };
}
export function formatEventDate(ev: CalendarEvent) {
  if (ev.start?.date) return ev.start.date;
  if (ev.start?.dateTime) {
    const d = new Date(ev.start.dateTime);
    const yyyy = d.getFullYear(),
      mm = String(d.getMonth() + 1).padStart(2, '0'),
      dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}
export function monthKeyFromEvent(ev: CalendarEvent) {
  const d = formatEventDate(ev);
  return d ? d.slice(0, 7) : '';
}
export function groupByMonth(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const k = monthKeyFromEvent(ev);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(ev);
  }
  return map;
}

export async function listEventsForYear(year: number): Promise<CalendarEvent[]> {
  const { timeMin, timeMax } = getYearRangeUTC(year);
  const token = await ensureAccessToken();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Calendar API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as CalendarListResponse;
  return data.items || [];
}
