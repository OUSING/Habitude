import { useEffect, useState } from "react";
import { Bell, CalendarDays, CheckCircle2, Sparkles, Target, Trash2 } from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { ColorPicker } from "../components/ui/ColorPicker";
import { IconPicker } from "../components/ui/IconPicker";
import { WeekdaySelector } from "../components/ui/WeekdaySelector";
import { TimePicker } from "../components/ui/TimePicker";
import { useHabit } from "../hooks/useHabits";
import { archiveHabit, createHabit, updateHabit } from "../services/habitService";
import { paletteDefault } from "../utils/palette";
import { defaultIcon, getIcon } from "../utils/icons";
import type { Weekday } from "../types/habit";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

interface Props {
  open: boolean;
  habitId?: number;
  onClose: () => void;
}

type FrequencyType = "daily" | "weekly";

export function AddEditHabit({ open, habitId, onClose }: Props) {
  const existing = useHabit(habitId);
  const isEditing = habitId != null;
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [color, setColor] = useState(paletteDefault());
  const [icon, setIcon] = useState(defaultIcon());
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [weeklyDays, setWeeklyDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [reminderTime, setReminderTime] = useState<string | undefined>(undefined);
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [target, setTarget] = useState("20");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Prefill the form once the existing habit loads (edit mode) or reset
  // it for a fresh "new habit" each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (isEditing && existing) {
      setName(existing.name);
      setColor(existing.color);
      setIcon(existing.icon ?? defaultIcon());
      setFrequencyType(existing.frequency.type);
      setWeeklyDays(existing.frequency.type === "weekly" ? existing.frequency.days : [1, 2, 3, 4, 5]);
      setReminderTime(existing.reminderTime);
      setIsMeasurable(!!existing.measurement);
      setTarget(existing.measurement ? String(existing.measurement.target) : "20");
      setUnit(existing.measurement?.unit ?? "");
    } else if (!isEditing) {
      setName("");
      setColor(paletteDefault());
      setIcon(defaultIcon());
      setFrequencyType("daily");
      setWeeklyDays([1, 2, 3, 4, 5]);
      setReminderTime(undefined);
      setIsMeasurable(false);
      setTarget("20");
      setUnit("");
    }
  }, [open, isEditing, existing]);

  // Some mobile keyboards (many non-English locales) send a comma as the
  // decimal separator for numeric inputs — without this, typing "2,5"
  // parses to NaN, silently fails the targetNum > 0 check below, and the
  // Save button just looks broken with no explanation.
  const targetNum = Number(target.replace(",", "."));
  const targetInvalid = isMeasurable && !(targetNum > 0);
  const unitInvalid = isMeasurable && unit.trim().length === 0;
  const canSave =
    name.trim().length > 0 &&
    (frequencyType === "daily" || weeklyDays.length > 0) &&
    !targetInvalid &&
    !unitInvalid;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const frequency =
        frequencyType === "daily" ? ({ type: "daily" } as const) : ({ type: "weekly", days: weeklyDays } as const);
      const measurement = isMeasurable ? { target: targetNum, unit: unit.trim() } : undefined;

      // Check notification permissions if a reminder is being set
      if (reminderTime && Capacitor.isNativePlatform()) {
        try {
          const status = await LocalNotifications.checkPermissions();
          if (status.display !== "granted") {
            const ok = await confirm({
              title: "Enable Notifications?",
              message: "You've set a reminder time, but notifications are currently disabled. Please enable notifications in your device settings to receive reminders.",
              confirmText: "Enable in Settings",
              cancelText: "Save Anyway",
              type: "warning"
            });
            if (ok) {
              await LocalNotifications.requestPermissions();
            }
          }
        } catch (err) {
          console.warn("Error checking notification permissions:", err);
        }
      }

      if (isEditing && habitId != null) {
        await updateHabit(habitId, { name: name.trim(), color, icon, frequency, reminderTime, measurement });
      } else {
        await createHabit({ name: name.trim(), color, icon, frequency, reminderTime, measurement });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Deleting is a soft delete (same as the swipe-to-delete gesture on the
  // dashboard) — it just hides the habit and its sub-habits, keeping
  // historical logs/stats intact. Available right from the editor so
  // deleting doesn't rely on discovering the swipe gesture.
  async function handleDelete() {
    if (!isEditing || habitId == null || deleting) return;
    const ok = await confirm({
      title: "Delete Habit",
      message: `Delete "${name.trim() || "this habit"}"? This can't be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await archiveHabit(habitId);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit habit" : "New habit"}>
      <div className="habit-editor">
        {/* The habit's own color drives every accent below it — the
            segmented controls, the weekday chips, the save button — so
            picking a color and icon further down visibly "claims" this
            whole form rather than just filling in a swatch field. */}
        <div className="habit-editor-hero">
          <div
            className="habit-editor-hero-icon"
            style={{ backgroundColor: `${color}20`, boxShadow: `0 10px 26px ${color}38` }}
            aria-hidden="true"
          >
            {(() => { const PreviewIcon = getIcon(icon); return <PreviewIcon size={26} strokeWidth={2.2} style={{ color }} />; })()}
          </div>
          <div className="habit-editor-hero-body">
            <input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your habit"
              aria-label="Habit name"
              maxLength={40}
              className="habit-editor-hero-name"
              autoFocus
            />
            <div className="habit-editor-hero-meta">
              <span className="habit-editor-hero-chip" style={{ backgroundColor: `${color}1c`, color }}>
                <CalendarDays size={11} strokeWidth={2.4} />
                {frequencyType === "daily" ? "Every day" : `${weeklyDays.length} day${weeklyDays.length === 1 ? "" : "s"}/week`}
              </span>
              <span className="habit-editor-hero-chip" style={{ backgroundColor: `${color}1c`, color }}>
                {isMeasurable ? (
                  <>
                    <Target size={11} strokeWidth={2.4} />
                    {target || 0} {unit || "units"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={11} strokeWidth={2.4} />
                    Simple check-in
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="habit-editor-grid">
          <section className="habit-editor-section">
            <div>
              <span className="habit-editor-section-title">
                <CalendarDays size={13} strokeWidth={2.4} />
                Frequency
              </span>
              <div className="habit-editor-segment">
                {(["daily", "weekly"] as FrequencyType[]).map((ft) => {
                  const active = frequencyType === ft;
                  return (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setFrequencyType(ft)}
                      className={active ? "is-active" : ""}
                      style={active ? { backgroundColor: color } : undefined}
                    >
                      {ft === "daily" ? "Every day" : "Specific days"}
                    </button>
                  );
                })}
              </div>
              {frequencyType === "weekly" && (
                <div className="mt-3">
                  <WeekdaySelector value={weeklyDays} onChange={setWeeklyDays} activeColor={color} />
                </div>
              )}
            </div>

            <div>
              <span className="habit-editor-section-title">
                <Target size={13} strokeWidth={2.4} />
                Tracking
              </span>
              <div className="habit-editor-segment">
                {([false, true] as const).map((measurable) => {
                  const active = isMeasurable === measurable;
                  return (
                    <button
                      key={String(measurable)}
                      type="button"
                      onClick={() => setIsMeasurable(measurable)}
                      className={active ? "is-active" : ""}
                      style={active ? { backgroundColor: color } : undefined}
                    >
                      {measurable ? "Quantity" : "Simple"}
                    </button>
                  );
                })}
              </div>
              {isMeasurable && (
                <div className="habit-editor-quantity-panel">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label htmlFor="habit-target" className="mb-1 block text-xs font-semibold text-muted">
                        Daily target
                      </label>
                      <input
                        id="habit-target"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder="20"
                        aria-invalid={targetInvalid}
                        className={[
                          "tap-target w-full rounded-lg bg-surface px-3 py-2 text-[15px] font-mono text-ink outline-none",
                          targetInvalid ? "ring-1 ring-accent" : ""
                        ].join(" ")}
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="habit-unit" className="mb-1 block text-xs font-semibold text-muted">
                        Unit
                      </label>
                      <input
                        id="habit-unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="e.g. pages, min, glasses"
                        maxLength={20}
                        aria-invalid={unitInvalid}
                        className={[
                          "tap-target w-full rounded-lg bg-surface px-3 py-2 text-[15px] text-ink outline-none",
                          unitInvalid ? "ring-1 ring-accent" : ""
                        ].join(" ")}
                      />
                    </div>
                  </div>
                  {/* Save is silently disabled until both fields are valid — spell
                      out why instead of leaving the button looking unresponsive. */}
                  {(targetInvalid || unitInvalid) && (
                    <p className="mt-2 text-[11px] font-medium text-accent">
                      {targetInvalid && unitInvalid
                        ? "Enter a target above 0 and a unit to save this habit."
                        : targetInvalid
                        ? "Enter a target above 0 to save this habit."
                        : "Enter a unit (e.g. pages, min) to save this habit."}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <span className="habit-editor-section-title">
                <Bell size={13} strokeWidth={2.4} />
                Reminder
              </span>
              <TimePicker value={reminderTime} onChange={setReminderTime} />
            </div>
          </section>

          <section className="habit-editor-section">
            <span className="habit-editor-section-title">
              <Sparkles size={13} strokeWidth={2.4} />
              Appearance
            </span>
            <div className="habit-editor-appearance-stack">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Color</span>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Icon</span>
                <IconPicker value={icon} color={color} onChange={setIcon} />
              </div>
            </div>
          </section>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            aria-label="Delete habit"
            className="tap-target mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-accent transition-colors duration-100 active:bg-accent/10 disabled:opacity-50"
          >
            <Trash2 size={15} strokeWidth={2.2} />
            {deleting ? "Deleting…" : "Delete habit"}
          </button>
        )}
        <div className="habit-editor-actions">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            disabled={!canSave || saving || deleting}
            onClick={handleSave}
            style={canSave ? { backgroundColor: color } : undefined}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
