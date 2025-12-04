import { useState } from 'react';
import { listEventsForYear, monthKeyFromEvent } from '@/lib/calendar';
import type { CalendarEvent } from '@/types/calendar';

export type { CalendarEvent };

export function useCalendarEvents() {
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async (year: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const events = await listEventsForYear(year);
      setAllEvents(events);
      setFilteredEvents(events);
      return events;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'イベント取得に失敗しました';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilter = (options: { keyword?: string; allDayOnly?: boolean; month?: string }) => {
    const { keyword, allDayOnly, month } = options;

    const filtered = allEvents.filter((ev) => {
      const isAllDay = !!ev.start?.date && !ev.start?.dateTime;

      if (allDayOnly && !isAllDay) return false;

      if (keyword) {
        const text = [ev.summary || '', ev.description || '', ev.location || '']
          .join(' ')
          .toLowerCase();
        if (!text.includes(keyword.toLowerCase())) return false;
      }

      if (month) {
        const evMonth = monthKeyFromEvent(ev);
        if (evMonth !== month) return false;
      }

      return true;
    });

    setFilteredEvents(filtered);
    return filtered;
  };

  return {
    allEvents,
    filteredEvents,
    isLoading,
    error,
    fetchEvents,
    applyFilter,
  };
}
