export const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));
export const wrapHue = (h: number) => ((h % 360) + 360) % 360;

export function downloadJSON(data: any, filename = "calendar-events.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
