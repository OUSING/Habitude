import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/** Fire-and-forget permission prompt, mounted once from App.tsx. */
export function useNotificationSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    LocalNotifications.checkPermissions().then((status) => {
      if (status.display === "granted") {
        LocalNotifications.requestPermissions();
      }
    });
  }, []);
}
