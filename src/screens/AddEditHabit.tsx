import { useEffect, useState } from "react";
import { Bell, CalendarDays, Minus, Plus, Sparkles, Target } from "lucide-react";
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
import { todayStr } from "../utils/date";
import type { Frequency, FrequencyUnit, Weekday } from "../types/habit";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

interface Props {
  open: boolean;
  habitId?: number;
  onClose: () => void;
}

type FrequencyType = "daily" | "custom";

// Common units offered as one-tap chips so most people never have to type
// in the free-text field below — it's still there for anything unusual.
const UNIT_PRESETS = ["min", "pages", "glasses", "steps", "km", "reps"];
const TARGET_STEP = 1;

export function AddEditHabit({ open, habitId, onClose }: Props) {
  const existing = useHabit(habitId);
  const isEditing = habitId != null;
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [color, setColor] = useState(paletteDefault());
  const [icon, setIcon] = useState(defaultIcon());
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [repeatInterval, setRepeatInterval] = useState<number | "">("");
  const [repeatUnit, setRepeatUnit] = useState<FrequencyUnit>("week");
  const [weeklyDays, setWeeklyDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [repeatAnchor, setRepeatAnchor] = useState<string>(todayStr());
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
      const f = existing.frequency;
      if (f.type === "daily") {
        setFrequencyType("daily");
        setRepeatInterval(1);
        setRepeatUnit("week");
        setWeeklyDays([1, 2, 3, 4, 5]);
        setRepeatAnchor(todayStr());
      } else if (f.type === "weekly") {
        // Legacy "Specific days" habits saved before the Custom repeat
        // editor — shown here as "every 1 week" on the same days.
        setFrequencyType("custom");
        setRepeatInterval(1);
        setRepeatUnit("week");
        setWeeklyDays(f.days);
        setRepeatAnchor(todayStr());
      } else {
        setFrequencyType("custom");
        setRepeatInterval(f.interval);
        setRepeatUnit(f.unit);
        setWeeklyDays(f.weekdays && f.weekdays.length > 0 ? f.weekdays : [1, 2, 3, 4, 5]);
        setRepeatAnchor(f.anchor);
      }
      setReminderTime(existing.reminderTime);
      setIsMeasurable(!!existing.measurement);
      setTarget(existing.measurement ? String(existing.measurement.target) : "20");
      setUnit(existing.measurement?.unit ?? "");
    } else if (!isEditing) {
      setName("");
      setColor(paletteDefault());
      setIcon(defaultIcon());
      setFrequencyType("daily");
      setRepeatInterval("");
      setRepeatUnit("week");
      setWeeklyDays([1, 2, 3, 4, 5]);
      setRepeatAnchor(todayStr());
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
  const isWhiteColor = color.toUpperCase() === "#FFFFFF";
  const weekdaysInvalid = frequencyType === "custom" && repeatUnit === "week" && weeklyDays.length === 0;
  const canSave =
    name.trim().length > 0 &&
    !weekdaysInvalid &&
    !targetInvalid &&
    !unitInvalid;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const frequency: Frequency =
        frequencyType === "daily"
          ? { type: "daily" }
          : {
              type: "custom",
              interval: Math.max(1, Math.round(Number(repeatInterval) || 1)),
              unit: repeatUnit,
              anchor: repeatAnchor,
              ...(repeatUnit === "week" ? { weekdays: weeklyDays } : {})
            };
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
            {(["daily", "custom"] as FrequencyType[]).map((ft) => {
              const active = frequencyType === ft;
              return (
                <button key={ft} type="button" onClick={() => setFrequencyType(ft)}
                  className={active ? "is-active" : ""} style={active ? { backgroundColor: color, color: isWhiteColor ? "#111827" : "#fff" } : undefined}>
                  {ft === "daily" ? "Every day" : "Custom"}
                </button>
              );
            })}
          </div>
          {frequencyType === "custom" && (
            <div className="habit-create-weekdays">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted">Every</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={repeatInterval}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setRepeatInterval("");
                      return;
                    }
                    setRepeatInterval(Math.max(1, Math.round(Number(raw)) || 1));
                  }}
                  placeholder="1"
                  className="w-16 rounded-lg border border-border bg-surface px-2 py-2 text-center text-[13px] text-ink outline-none"
                />
                <select
                  value={repeatUnit}
                  onChange={(e) => setRepeatUnit(e.target.value as FrequencyUnit)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-[13px] text-ink outline-none"
                >
                  <option value="day">day(s)</option>
                  <option value="week">week(s)</option>
                  <option value="month">month(s)</option>
                  <option value="year">year(s)</option>
                </select>
              </div>
              {repeatUnit === "week" && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold text-muted">Repeat on</p>
                  <div className="habit-create-weekdays-grid">
                    <WeekdaySelector value={weeklyDays} onChange={setWeeklyDays} activeColor={color} activeTextColor={isWhiteColor ? "#111827" : "#fff"} />
                  </div>
                  {weekdaysInvalid && <p className="mt-2 text-[10px] font-semibold text-accent">Pick at least one day.</p>}
                </div>
              )}
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
                  className={active ? "is-active" : ""} style={active ? { backgroundColor: color, color: isWhiteColor ? "#111827" : "#fff" } : undefined}>
                  {measurable ? "Quantity" : "Simple check"}
                </button>
              );
            })}
          </div>
          {isMeasurable && (
            <div className="habit-create-quantity habit-create-quantity-redesign">
              <div className="habit-create-target-field">
                <label htmlFor="habit-target">Daily target</label>
                <div className="habit-create-target-stepper">
                  <button
                    type="button"
                    aria-label="Decrease target"
                    onClick={() => {
                      const next = Math.max(0, (Number(target.replace(",", ".")) || 0) - TARGET_STEP);
                      setTarget(String(next));
                    }}
                    style={{ borderColor: `${color}40`, color }}
                  >
                    <Minus size={14} strokeWidth={2.5} />
                  </button>
                  <input
                    id="habit-target"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="20"
                    aria-invalid={targetInvalid}
                  />
                  <button
                    type="button"
                    aria-label="Increase target"
                    onClick={() => {
                      const next = (Number(target.replace(",", ".")) || 0) + TARGET_STEP;
                      setTarget(String(next));
                    }}
                    style={{ backgroundColor: color }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="habit-create-unit-field">
                <label htmlFor="habit-unit">Unit</label>
                <div className="habit-create-unit-chips" role="group" aria-label="Common units">
                  {UNIT_PRESETS.map((preset) => {
                    const active = unit.trim().toLowerCase() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUnit(preset)}
                        aria-pressed={active}
                        style={active ? { backgroundColor: color, borderColor: color, color: isWhiteColor ? "#111827" : "#fff" } : undefined}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="habit-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="or type your own, e.g. verres"
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
            style={canSave ? { backgroundColor: color, color: isWhiteColor ? "#111827" : "#fff" } : undefined}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Create habit"}
          </Button>
        </div>


      </div>
    </Modal>
  );
}
