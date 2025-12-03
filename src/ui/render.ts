import { formatEventDate, groupByMonth } from "../lib/calendar";

export function renderMonthly(listEl: HTMLElement, events: any[]) {
  listEl.innerHTML = "";
  const monthly = groupByMonth(events);
  const months = Array.from(monthly.keys()).sort();

  // 年別にグループ化
  const yearGroups = new Map<string, Map<string, any[]>>();
  for (const [ym, evs] of monthly.entries()) {
    const year = ym.slice(0, 4); // YYYY
    if (!yearGroups.has(year)) {
      yearGroups.set(year, new Map());
    }
    yearGroups.get(year)!.set(ym, evs);
  }

  const frag = document.createDocumentFragment();

  // 年ごとにdetailsを作成
  for (const [year, monthMap] of Array.from(yearGroups.entries()).sort()) {
    const yearDetails = document.createElement("details");
    yearDetails.open = false;
    const yearSummary = document.createElement("summary");
    const totalEvents = Array.from(monthMap.values()).reduce(
      (sum, evs) => sum + evs.length,
      0
    );
    yearSummary.textContent = `${year} | ${totalEvents}件`;
    yearDetails.appendChild(yearSummary);

    // 月ごとのdetailsを作成
    const monthContainer = document.createElement("div");
    monthContainer.style.marginLeft = "1rem";

    for (const [ym, evs] of Array.from(monthMap.entries()).sort()) {
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `${ym} | ${evs.length}件`;
      details.appendChild(summary);
      const ul = document.createElement("ul");
      for (const ev of evs) {
        const li = document.createElement("li");
        li.textContent = `${formatEventDate(ev)} | ${ev.summary || "(無題)"}`;
        ul.appendChild(li);
      }
      details.appendChild(ul);
      monthContainer.appendChild(details);
    }

    yearDetails.appendChild(monthContainer);
    frag.appendChild(yearDetails);
  }

  listEl.appendChild(frag);
}
