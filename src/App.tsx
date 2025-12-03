import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventList } from '@/components/EventList';
import { useGummyWorld } from '@/hooks/useGummyWorld';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useCalendarEvents, CalendarEvent } from '@/hooks/useCalendarEvents';
import { colorFromEmotionText, diversifyColors } from '@/lib/color';
import { monthKeyFromEvent } from '@/lib/calendar';
import '@/index.css';

type Gummy = {
  id: string;
  date: string;
  kind: string;
  title: string;
  color: string;
  weight: number;
  hsl?: { h: number; s: number; l: number };
  isBirthday?: boolean;
};

function toGummies(events: CalendarEvent[]): Gummy[] {
  return events.map((ev) => {
    const title = ev.summary || '';
    const text = [title, ev.description || '', ev.location || ''].join(' ');
    const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
    const attendees = ev.attendees?.length || 0;
    let durationHours = 0;
    if (ev.start?.dateTime && ev.end?.dateTime) {
      durationHours = Math.max(
        0,
        (new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()) / 3600000
      );
    }
    const col = colorFromEmotionText(text, {
      isAllDay,
      attendees,
      durationHours,
    });
    const lower = text.toLowerCase();
    const kind = /mtg|会議|meeting/.test(lower)
      ? 'meeting'
      : /勉強|講義|study|learn/.test(lower)
        ? 'study'
        : /開発|実装|コード|code|task|作業|課題/.test(lower)
          ? 'work'
          : /休暇|旅行|家族|買い物|生活|life/.test(lower)
            ? 'life'
            : 'other';
    const baseWeight = isAllDay ? 0.9 : 1.0;
    let weight = Math.min(
      4,
      baseWeight + Math.log2(attendees + 1) + Math.min(1.5, durationHours / 6)
    );
    // 誕生日判定（タイトル/説明/場所に "誕生日" または "birthday"）
    const isBirthday = /誕生日|birthday/i.test(text);
    if (isBirthday) {
      weight = Math.min(4, weight * 1.5);
    }
    return {
      id: ev.id,
      date: '',
      kind,
      title,
      color: col.hex,
      weight,
      hsl: { h: col.h, s: col.s, l: col.l },
      isBirthday,
    };
  });
}

export default function App() {
  const [year, setYear] = useState(2025);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [allDayOnly, setAllDayOnly] = useState(false);

  const { initialize, getAccessToken } = useGoogleAuth();
  const { filteredEvents, fetchEvents, applyFilter } = useCalendarEvents();
  const {
    canvasRef,
    addGummies,
    clearGummies,
    canvasSize,
  }: {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    addGummies: (gummies: { color: string; weight: number; isBirthday?: boolean }[]) => void;
    clearGummies: () => void;
    canvasSize: { width: number; height: number };
  } = useGummyWorld({
    centerBias: 0.12,
    inwardForce: 0.0,
    restitution: 0.22,
    maxParticles: 1000,
  });

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetch = async () => {
    setStatus(`${year}年のイベント取得中…`);
    try {
      await getAccessToken();
      const events = await fetchEvents(year);
      setStatus(`取得完了:${events.length}件 (グミを生成中…)`);
      toast.success(`${events.length}件のイベントを取得しました`);

      // 1秒待ってから年間グミシャワー（3秒/12回）を自動開始
      setTimeout(() => {
        if (events.length > 0) {
          startYearShower(events);
        }
      }, 1000);
    } catch (e) {
      const message = e instanceof Error ? e.message : '取得に失敗しました';
      setStatus(`失敗：${message}`);
      toast.error(`エラー: ${message}`);
    }
  };

  const startYearShower = (events: CalendarEvent[]) => {
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    let i = 0;
    const interval = Math.floor(3000 / 12);

    const timer = setInterval(() => {
      if (i >= months.length) {
        clearInterval(timer);
        setStatus('');
        return;
      }
      const key = `${year}-${months[i++]}`;
      const batch = events.filter((ev) => monthKeyFromEvent(ev) === key);
      if (batch.length) {
        let gummies = toGummies(batch);
        gummies = diversifyColors(gummies, { threshold: 0.6, jitterDeg: 22 });
        addGummies(gummies);
      }
    }, interval);
  };

  const handleFilter = () => {
    const filtered = applyFilter({ keyword, allDayOnly });
    setStatus(`フィルター適用：${filtered.length}件`);
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">カレンダーの予定をグミにする</h1>
        <span className="text-sm text-muted-foreground">〜一年を振り返ろう〜</span>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            <label>年のカレンダーを</label>
          </div>
          <Button
            onClick={() => {
              void handleFetch();
            }}
          >
            グミにする
          </Button>
          <Button variant="outline" onClick={clearGummies}>
            グミを削除
          </Button>
          <span className="text-sm text-muted-foreground">{status}</span>
        </div>
      </Card>

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border border-border rounded-md w-full"
      />

      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <Input
            placeholder="キーワード（タイトル/説明）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="allDayOnly"
              checked={allDayOnly}
              onCheckedChange={(checked) => setAllDayOnly(checked === true)}
            />
            <Label htmlFor="allDayOnly">終日の予定のみ</Label>
          </div>
          <Button onClick={handleFilter} variant="secondary">
            フィルター適用
          </Button>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground mb-2">
        取得済みイベント: {filteredEvents.length}件
      </div>

      <EventList events={filteredEvents} />
    </div>
  );
}
