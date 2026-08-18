import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { removeLegacyStepsHabit, startLiveStepUpdates } from "../services/stepTracker";

/** Keeps the native step listener armed. There is intentionally no polling or
 * sync call here: the pedometer is not a habit and nothing is logged to the
 * habit database. */
export function useStepSync() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void removeLegacyStepsHabit();
    void startLiveStepUpdates();

    let listenerHandle: { remove: () => void } | undefined;
    CapacitorApp.addListener("resume", () => {
      void startLiveStepUpdates();
    }).then((handle) => { listenerHandle = handle; })
      .catch((err) => console.warn("Failed to register app resume listener", err));

    return () => { listenerHandle?.remove(); };
  }, []);
}
