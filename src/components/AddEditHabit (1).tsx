import { useEffect, useState } from "react";
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

  async function handleDelete() {
    if (habitId == null) return;
    const ok = await confirm({
      title: "Delete Habit?",
      message: `Are you sure you want to delete "${existing?.name ?? "this habit"}"? This will archive all its history.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger"
    });
    if (!ok) return;
    await archiveHabit(habitId);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit habit" : "New habit"}>
      <div className="habit-editor">
        <div className="habit-editor-intro">
          <div className="habit-editor-preview" style={{ backgroundColor: `${color}18`, color }}>
            {(() => { const PreviewIcon = getIcon(icon); return <PreviewIcon size={22} />; })()}
          </div>
          <div>
            <strong>{name.trim() || "Your new habit"}</strong>
            <span>{frequencyType === "daily" ? "Every day" : `${weeklyDays.length} selected days`}{isMeasurable ? ` · ${target || 0} ${unit || "units"}` : " · Simple check-in"}</span>
          </div>
        </div>
        <div className="habit-editor-grid">
          <section className="habit-editor-section">
        <div>
          <label htmlFor="habit-name" className="mb-1.5 block text-sm font-semibold text-ink">
            Habit name
          </label>
          <input
            id="habit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Read 10 minutes"
            maxLength={40}
            className="tap-target w-full rounded-xl bg-surface-2 px-4 py-3 text-[15px] text-ink outline-none"
            autoFocus
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Frequency</span>
          <div className="mb-3 flex gap-2">
            {(["daily", "weekly"] as FrequencyType[]).map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setFrequencyType(ft)}
                className={[
                  "tap-target flex-1 rounded-xl text-sm font-semibold transition-colors duration-100",
                  frequencyType === ft ? "bg-ink text-bg" : "bg-surface-2 text-ink active:bg-border"
                ].join(" ")}
              >
                {ft === "daily" ? "Every day" : "Specific days"}
              </button>
            ))}
          </div>
          {frequencyType === "weekly" && <WeekdaySelector value={weeklyDays} onChange={setWeeklyDays} />}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Tracking</span>
          <div className="mb-3 flex gap-2">
            {([false, true] as const).map((measurable) => (
              <button
                key={String(measurable)}
                type="button"
                onClick={() => setIsMeasurable(measurable)}
                className={[
                  "tap-target flex-1 rounded-xl text-sm font-semibold transition-colors duration-100",
                  isMeasurable === measurable ? "bg-ink text-bg" : "bg-surface-2 text-ink active:bg-border"
                ].join(" ")}
              >
                {measurable ? "Quantity" : "Simple"}
              </button>
            ))}
          </div>
          {isMeasurable && (
            <div className="rounded-xl bg-surface-2 p-3">
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
          <span className="mb-1.5 block text-sm font-semibold text-ink">Reminder</span>
          <TimePicker value={reminderTime} onChange={setReminderTime} />
        </div>



          </section>
          <section className="habit-editor-section">
            <div className="habit-editor-section-title">Appearance</div>
            <div className="habit-editor-appearance-stack">
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-ink">Color</span>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-ink">Icon</span>
                <IconPicker value={icon} color={color} onChange={setIcon} />
              </div>
            </div>
          </section>
        </div>
        <div className="habit-editor-actions">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth disabled={!canSave || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {isEditing && (
            <Button variant="danger" fullWidth onClick={handleDelete}>
              Delete habit
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
