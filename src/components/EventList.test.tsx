import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventList } from '@/components/EventList';
import type { CalendarEvent } from '@/types/calendar';

describe('EventList', () => {
  it('イベントがない場合はメッセージを表示', () => {
    render(<EventList events={[]} />);
    expect(
      screen.getByText('イベントがありません。取得ボタンを押してください。')
    ).toBeInTheDocument();
  });

  it('イベントを年月別に表示', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'テストイベント1',
        start: { date: '2025-01-15' },
        end: { date: '2025-01-15' },
      },
      {
        id: '2',
        summary: 'テストイベント2',
        start: { date: '2025-01-20' },
        end: { date: '2025-01-20' },
      },
    ];

    render(<EventList events={mockEvents} />);
    expect(screen.getByText(/イベントリスト/)).toBeInTheDocument();
    expect(screen.getByText(/2025年 \(2件\)/)).toBeInTheDocument();
  });
});
