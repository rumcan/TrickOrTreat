// rundot-import:sdk-init:begin
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
try {
  await RundotGameAPI.initializeAsync();
} catch {
  // Boot continues even if SDK init fails.
}
// rundot-import:sdk-init:end

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { preloadStorage } from "./game/storage";

// Saves and settings are read at module load, so the device cache is filled before the game modules are imported.
await preloadStorage();
const { default: App } = await import("./App");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
