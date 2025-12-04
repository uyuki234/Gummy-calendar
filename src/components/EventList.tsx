import { Card } from '@/components/ui/card';
import { groupByMonth, formatEventDate } from '@/lib/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { useState } from 'react';

interface EventListProps {
  events: CalendarEvent[];
}

export function EventList({ events }: EventListProps) {
  const monthlyGroups = groupByMonth(events);
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  // 年ごとにグループ化
  const yearGroups = new Map<number, Map<string, CalendarEvent[]>>();
  for (const [monthKey, monthEvents] of monthlyGroups.entries()) {
    const eventYear = parseInt(monthKey.split('-')[0], 10);
    if (!yearGroups.has(eventYear)) {
      yearGroups.set(eventYear, new Map<string, CalendarEvent[]>());
    }
    yearGroups.get(eventYear)!.set(monthKey, monthEvents);
  }

  const toggleYear = (y: number) => {
    const newSet = new Set(openYears);
    if (newSet.has(y)) {
      newSet.delete(y);
    } else {
      newSet.add(y);
    }
    setOpenYears(newSet);
  };

  const toggleMonth = (monthKey: string) => {
    const newSet = new Set(openMonths);
    if (newSet.has(monthKey)) {
      newSet.delete(monthKey);
    } else {
      newSet.add(monthKey);
    }
    setOpenMonths(newSet);
  };

  if (events.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          イベントがありません。取得ボタンを押してください。
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 max-h-[600px] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-3">イベントリスト</h2>
      <div className="space-y-2">
        {Array.from(yearGroups.entries())
          .sort(([a], [b]) => b - a)
          .map(([eventYear, months]) => {
            const yearTotal = Array.from(months.values()).reduce((sum, evs) => sum + evs.length, 0);
            const isYearOpen = openYears.has(eventYear);

            return (
              <div key={eventYear} className="border rounded-md">
                <button
                  onClick={() => toggleYear(eventYear)}
                  className="w-full px-3 py-2 text-left font-medium hover:bg-accent rounded-md transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">{isYearOpen ? '▼' : '▶'}</span>
                  <span>
                    {eventYear}年 ({yearTotal}件)
                  </span>
                </button>

                {isYearOpen && (
                  <div className="px-3 pb-2 space-y-1">
                    {Array.from(months.entries())
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([monthKey, monthEvents]) => {
                        const isMonthOpen = openMonths.has(monthKey);
                        return (
                          <div key={monthKey} className="ml-4 border-l-2 pl-2">
                            <button
                              onClick={() => toggleMonth(monthKey)}
                              className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent rounded transition-colors flex items-center gap-2"
                            >
                              <span>{isMonthOpen ? '▼' : '▶'}</span>
                              <span>
                                {monthKey} ({monthEvents.length}件)
                              </span>
                            </button>

                            {isMonthOpen && (
                              <ul className="mt-1 space-y-1 ml-4">
                                {monthEvents.map((ev) => (
                                  <li
                                    key={ev.id}
                                    className="text-xs p-2 bg-muted/50 rounded border"
                                  >
                                    <div className="font-medium">
                                      {ev.summary || '(タイトルなし)'}
                                    </div>
                                    <div className="text-muted-foreground mt-0.5">
                                      {formatEventDate(ev)}
                                      {ev.location && (
                                        <span className="ml-2">📍 {ev.location}</span>
                                      )}
                                    </div>
                                    {ev.description && (
                                      <div className="text-muted-foreground mt-1 line-clamp-2">
                                        {ev.description}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </Card>
  );
}
