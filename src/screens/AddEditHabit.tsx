import { useEffect, useState } from "react";
import { Bell, CalendarDays, Sparkles, Target } from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { ColorPicker } from "../components/ui/ColorPicker";
import { IconPicker } from "../components/ui/IconPicker";
import { WeekdaySelector } from "../components/ui/WeekdaySelector";
import { TimePicker } from "../components/ui/TimePicker";
import { useHabit } from "../hooks/useHabits";
import { createHabit, updateHabit } from "../services/habitService";
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


  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit habit" : "Create a habit"}>
      <div className="habit-editor habit-editor-simple">
        <div className="habit-create-intro">
          <div className="habit-create-preview" style={{ backgroundColor: `${color}18`, color }} aria-hidden="true">
            {(() => { const PreviewIcon = getIcon(icon); return <PreviewIcon size={25} strokeWidth={2.2} />; })()}
          </div>
          <div className="min-w-0">
            <span className="habit-create-kicker">{isEditing ? "Edit your habit" : "Start a new habit"}</span>
            <p className="habit-create-hint">Keep it simple. You can change these settings later.</p>
          </div>
        </div>

        <div className="habit-create-field">
          <label htmlFor="habit-name">Habit name</label>
          <input
            id="habit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Drink water"
            aria-label="Habit name"
            maxLength={40}
            className="habit-create-name-input"
            autoFocus
          />
        </div>

        <section className="habit-create-section">
          <div className="habit-create-section-heading">
            <span><Sparkles size={15} /> Color</span><small>Choose one</small>
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </section>

        <section className="habit-create-section">
          <div className="habit-create-section-heading">
            <span><Sparkles size={15} /> Icon</span><small>Pick one</small>
          </div>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </section>

        <section className="habit-create-section">
          <div className="habit-create-section-heading">
            <span><CalendarDays size={15} /> Frequency</span>
          </div>
          <div className="habit-editor-segment">
            {(["daily", "weekly"] as FrequencyType[]).map((ft) => {
              const active = frequencyType === ft;
              return (
                <button key={ft} type="button" onClick={() => setFrequencyType(ft)}
                  className={active ? "is-active" : ""} style={active ? { backgroundColor: color } : undefined}>
                  {ft === "daily" ? "Every day" : "Specific days"}
                </button>
              );
            })}
          </div>
          {frequencyType === "weekly" && (
            <div className="habit-create-weekdays">
              <WeekdaySelector value={weeklyDays} onChange={setWeeklyDays} activeColor={color} />
            </div>
          )}
        </section>

        <section className="habit-create-section">
          <div className="habit-create-section-heading">
            <span><Target size={15} /> Tracking</span><small>How you complete it</small>
          </div>
          <div className="habit-editor-segment">
            {([false, true] as const).map((measurable) => {
              const active = isMeasurable === measurable;
              return (
                <button key={String(measurable)} type="button" onClick={() => setIsMeasurable(measurable)}
                  className={active ? "is-active" : ""} style={active ? { backgroundColor: color } : undefined}>
                  {measurable ? "Quantity" : "Simple check"}
                </button>
              );
            })}
          </div>
          {isMeasurable && (
            <div className="habit-create-quantity">
              <div>
                <label htmlFor="habit-target">Daily target</label>
                <input id="habit-target" type="number" inputMode="decimal" min={1} value={target}
                  onChange={(e) => setTarget(e.target.value)} placeholder="20" aria-invalid={targetInvalid} />
              </div>
              <div className="habit-create-unit-field">
                <label htmlFor="habit-unit">Unit</label>
                <input
                  id="habit-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. pages, minutes, glasses"
                  maxLength={20}
                  aria-invalid={unitInvalid}
                />
              </div>
              {(targetInvalid || unitInvalid) && (
                <p>{targetInvalid && unitInvalid ? "Enter a target above 0 and a unit." : targetInvalid ? "Enter a target above 0." : "Enter a unit."}</p>
              )}
            </div>
          )}
        </section>

        <section className="habit-create-section">
          <div className="habit-create-section-heading">
            <span><Bell size={15} /> Reminder</span><small>Optional</small>
          </div>
          <TimePicker value={reminderTime} onChange={setReminderTime} />
        </section>

        <div className="habit-editor-actions habit-create-actions">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" fullWidth disabled={!canSave || saving} onClick={handleSave}
            style={canSave ? { backgroundColor: color } : undefined}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Create habit"}
          </Button>
        </div>


      </div>
    </Modal>
  );
}
