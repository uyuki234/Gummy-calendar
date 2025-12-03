import { initTokenClient } from "../lib/auth";
import { listEventsForYear, monthKeyFromEvent } from "../lib/calendar";
import { downloadJSON } from "../lib/utils";
import { colorFromEmotionText, diversifyColors } from "../lib/color";
import { GummyWorld } from "../physics/GummyWorld";
import { state } from "../state";
import { renderMonthly } from "./render";

type Gummy = {
  id: string;
  date: string;
  kind: string;
  title: string;
  color: string;
  weight: number;
  hsl?: { h: number; s: number; l: number };
};

function toGummies(events: any[]): Gummy[] {
  return events.map((ev) => {
    const title = ev.summary || "";
    const text = [title, ev.description || "", ev.location || ""].join(" ");
    const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
    const attendees = ev.attendees?.length || 0;
    let durationHours = 0;
    if (ev.start?.dateTime && ev.end?.dateTime) {
      durationHours = Math.max(
        0,
        (new Date(ev.end.dateTime).getTime() -
          new Date(ev.start.dateTime).getTime()) /
          3600000
      );
    }
    const col = colorFromEmotionText(text, {
      isAllDay,
      attendees,
      durationHours,
    });
    const lower = text.toLowerCase();
    const kind = /mtg|会議|meeting/.test(lower)
      ? "meeting"
      : /勉強|講義|study|learn/.test(lower)
      ? "study"
      : /開発|実装|コード|code|task|作業|課題/.test(lower)
      ? "work"
      : /休暇|旅行|家族|買い物|生活|life/.test(lower)
      ? "life"
      : "other";
    const baseWeight = isAllDay ? 0.9 : 1.0;
    const weight = Math.min(
      4,
      baseWeight + Math.log2(attendees + 1) + Math.min(1.5, durationHours / 6)
    );
    return {
      id: ev.id,
      date: "",
      kind,
      title,
      color: col.hex,
      weight,
      hsl: { h: col.h, s: col.s, l: col.l },
    };
  });
}

export function wireControls() {
  // 初期化
  initTokenClient();
  const $year = document.getElementById("year-select") as HTMLSelectElement;
  const $fetch = document.getElementById("fetch-btn")!;
  const $status = document.getElementById("status")!;
  const $list = document.getElementById("event-list")!;
  const $q = document.getElementById("q") as HTMLInputElement;
  const $allDay = document.getElementById("allDayOnly") as HTMLInputElement;
  const $apply = document.getElementById("apply-filter")!;
  const $download = document.getElementById("download-json")!;
  // const $drop = document.getElementById("drop-btn")!;
  const $month = document.getElementById("month-select") as HTMLSelectElement;
  // const $dropMonth = document.getElementById("drop-month-btn")!;
  // const $shower = document.getElementById("shower-btn")!;
  const world = new GummyWorld(
    document.getElementById("gummy-canvas") as HTMLCanvasElement,
    {
      centerBias: 0.12,
      inwardForce: 0.0,
      restitution: 0.22,
      maxParticles: 1000,
    }
  );

  // 取得
  $fetch.addEventListener("click", async () => {
    const year = parseInt($year.value, 10);
    state.year = year;
    $status.textContent = `${year}年のイベント取得中…`;
    try {
      state.allEvents = await listEventsForYear(year);
      state.filteredEvents = state.allEvents; // 初期は全件
      renderMonthly($list, state.filteredEvents);
      $status.textContent = `取得完了:${state.filteredEvents.length}件 (まもなく年間グミシャワー開始…)`;
      (window as any).currentEvents = state.filteredEvents; // 互換

      // 1秒待ってから年間グミシャワー（3秒/12回）を自動開始
      setTimeout(() => {
        if (state.filteredEvents.length > 0) {
          startYearShower();
        }
      }, 1000);
    } catch (e: any) {
      console.error(e);
      $status.textContent = `失敗：${e.message}`;
    }
  });

  // フィルター
  $apply.addEventListener("click", () => {
    const q = $q.value.trim().toLowerCase();
    const allDayOnly = $allDay.checked;
    state.filteredEvents = state.allEvents.filter((ev) => {
      const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
      if (allDayOnly && !isAllDay) return false;
      if (q) {
        const text = [ev.summary || "", ev.description || "", ev.location || ""]
          .join(" ")
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
    renderMonthly($list, state.filteredEvents);
    (window as any).currentEvents = state.filteredEvents;
    $status.textContent = `フィルター適用：${state.filteredEvents.length}件`;
  });

  // ダウンロード
  $download.addEventListener("click", () => {
    downloadJSON(state.filteredEvents, `calendar-${state.year}.json`);
  });

  // // グミ落下（全件/フィルター後）
  // $drop.addEventListener("click", () => {
  //   if (!state.filteredEvents.length) {
  //     alert("イベントがありません。取得＆フィルターを確認してください。");
  //     return;
  //   }
  //   let gummies = toGummies(state.filteredEvents);
  //   gummies = diversifyColors(gummies, { threshold: 0.6, jitterDeg: 22 });
  //   world.addGummies(gummies);
  // });

  // // この月だけ
  // $dropMonth.addEventListener("click", () => {> {
  //   const key = `${state.year}-${$month.value}`; // YYYY-MM
  //   const events = state.filteredEvents.filter(
  //     (ev) => monthKeyFromEvent(ev) === key
  //   );
  //   if (!events.length) {
  //     alert(`${key} のイベントがありません。`);
  //     return;
  //   }
  //   let gummies = toGummies(events);
  //   gummies = diversifyColors(gummies, { threshold: 0.6, jitterDeg: 22 });
  //   world.addGummies(gummies);
  // });

  // 年間シャワー（3秒/12回）を関数化
  let timer: number | null = null;
  function startYearShower() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    const months = Array.from({ length: 12 }, (_, i) =>
      String(i + 1).padStart(2, "0")
    );
    let i = 0;
    const interval = Math.floor(3000 / 12);
    timer = window.setInterval(() => {
      if (i >= months.length) {
        clearInterval(timer!);
        timer = null;
        // シャワー終了時にステータスメッセージをクリア
        $status.textContent = "";
        return;
      }
      const key = `${state.year}-${months[i++]}`;
      const batch = state.filteredEvents.filter(
        (ev) => monthKeyFromEvent(ev) === key
      );
      if (batch.length) {
        let gummies = toGummies(batch);
        gummies = diversifyColors(gummies, { threshold: 0.6, jitterDeg: 22 });
        world.addGummies(gummies);
      }
    }, interval);
  }

  // // ボタンから年間シャワー起動
  // $shower.addEventListener("click", () => {
  //   startYearShower();
  // });
}
