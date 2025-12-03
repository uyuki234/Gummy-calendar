import { wireControls } from "./ui/controls";
import { initTokenClient } from "./lib/auth";

window.addEventListener("load", () => {
  initTokenClient(); // GIS初期化
  wireControls(); // UI配線
});
