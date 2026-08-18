import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { ensureNotificationPermission } from "../../services/notifications";

const NOTIF_PROMPTED_KEY = "habit-tracker:notifPrompted";

interface Props {
  onClose: () => void;
}

export function NotificationPrimer({ onClose }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function checkState() {
      // Only show on native devices, and if we haven't prompted before
      if (!Capacitor.isNativePlatform()) return;
      
      const { value } = await Preferences.get({ key: NOTIF_PROMPTED_KEY });
      if (value === "true") return;

      try {
        const current = await LocalNotifications.checkPermissions();
        if (current.display === "prompt") {
          // Delay slightly so the user has settled in
          setTimeout(() => setOpen(true), 1500);
        }
      } catch (err) {
        console.warn("Error checking notification permissions:", err);
      }
    }
    checkState();
  }, [onClose]);

  async function handleEnable() {
    setOpen(false);
    await Preferences.set({ key: NOTIF_PROMPTED_KEY, value: "true" });
    await ensureNotificationPermission();
    onClose();
  }

  async function handleDismiss() {
    setOpen(false);
    await Preferences.set({ key: NOTIF_PROMPTED_KEY, value: "true" });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[4px]"
        onClick={handleDismiss}
      />

      {/* Dialog box */}
      <div className="relative z-10 w-full max-w-sm animate-pop overflow-hidden rounded-3xl bg-surface p-6 shadow-2xl border border-border">
        <div className="flex flex-col items-center text-center">
          {/* Animated pulsing bell icon */}
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-inner">
            <Bell size={24} className="animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand"></span>
            </span>
          </div>

          <h3 className="font-display text-lg font-semibold text-ink">
            Enable Habit Reminders?
          </h3>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Get friendly daily alerts to complete your habits and maintain your streak. You can customize reminder times for each habit.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleEnable}
            className="tap-target w-full rounded-xl bg-brand py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand/90 active:bg-brand/80 shadow-sm"
          >
            Yes, Keep Me on Track
          </button>
          <button
            onClick={handleDismiss}
            className="tap-target w-full rounded-xl bg-surface-2 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-border active:bg-border-dark"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
