import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useConfirm } from "./ConfirmDialog";


export interface SwipeAction {
  /** Called after the user swipes past the threshold (and confirms, unless
   *  `requireConfirm` is false). */
  onTrigger: () => void | Promise<void>;
  /** Icon revealed behind the row as it's dragged toward this side. */
  icon: ReactNode;
  /** Background color class for the revealed panel. Defaults to a
   *  destructive red — pass something else for non-destructive actions. */
  bgClassName?: string;
  /** Shown in the native confirm dialog, e.g. `Delete "Read"?`. Unused
   *  when `requireConfirm` is false. */
  confirmMessage?: string;
  /** Whether to ask for confirmation before firing the action. Defaults
   *  to true — set to false for reversible actions like "edit". */
  requireConfirm?: boolean;
}

interface Props {
  children: ReactNode;
  className?: string;
  /** Revealed on the right edge when the user drags the row leftward. */
  onSwipeLeft?: SwipeAction;
  /** Revealed on the left edge when the user drags the row rightward. */
  onSwipeRight?: SwipeAction;
}

const THRESHOLD = 40; // px of horizontal movement needed to count as "a swipe"

/**
 * Wraps a row (habit card, loop row, to-do item…) so swiping it left or
 * right triggers a side-specific action — e.g. swipe right to delete.
 * This is a simple gesture sensor: once the drag crosses THRESHOLD in a
 * direction with a registered action, the action fires immediately (no
 * need to drag further or release at a precise spot), and the row snaps
 * back. Pointer capture keeps the gesture from being dropped if the
 * cursor moves quickly, which matters most for mouse/desktop dragging.
 */
export function SwipeToDelete({ children, className, onSwipeLeft, onSwipeRight }: Props) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const fired = useRef(false);
  const confirm = useConfirm();

  function handlePointerDown(e: ReactPointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId.current = e.pointerId;
    axis.current = null;
    fired.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    // Deliberately NOT calling setPointerCapture here. Capturing on every
    // pointerdown — including taps on nested buttons (checkbox, chevron,
    // trash…) — causes the browser to retarget the resulting "click" event
    // to this wrapper instead of the button underneath, silently eating
    // the button's onClick. We only capture once we've confirmed an actual
    // horizontal drag is happening (see handlePointerMove), which is after
    // any legitimate tap/click would already have resolved.
  }

  async function fireAction(action: SwipeAction, direction: -1 | 1) {
    fired.current = true;
    setIsDragging(false);
    setDragX(direction * THRESHOLD);
    const requireConfirm = action.requireConfirm ?? true;
    let ok = true;
    if (requireConfirm) {
      ok = await confirm({
        title: "Delete Confirmation",
        message: action.confirmMessage ?? "Are you sure you want to delete this item?",
        confirmText: "Delete",
        cancelText: "Cancel",
        type: "danger"
      });
    }
    if (ok) {
      await action.onTrigger();
    }
    setDragX(0);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (pointerId.current !== e.pointerId || fired.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (axis.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "x") {
        setIsDragging(true);
        // Now that we know this is a real horizontal swipe (not a click),
        // capture the pointer so the drag keeps tracking smoothly even if
        // the cursor/finger moves off the row.
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
    if (axis.current === "y") return; // vertical scroll, not our gesture

    e.preventDefault();
    const min = onSwipeLeft ? -THRESHOLD : 0;
    const max = onSwipeRight ? THRESHOLD : 0;
    const clamped = Math.min(max, Math.max(min, dx));
    setDragX(clamped);

    // Simple sensor: as soon as the swipe crosses the threshold, fire
    // right away rather than waiting for the pointer to lift.
    if (clamped <= -THRESHOLD && onSwipeLeft) {
      void fireAction(onSwipeLeft, -1);
    } else if (clamped >= THRESHOLD && onSwipeRight) {
      void fireAction(onSwipeRight, 1);
    }
  }

  function handlePointerUp(e: ReactPointerEvent) {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    axis.current = null;
    setIsDragging(false);
    if (!fired.current) setDragX(0);
  }

  const leftRevealRatio = Math.min(1, Math.max(0, -dragX) / THRESHOLD);
  const rightRevealRatio = Math.min(1, Math.max(0, dragX) / THRESHOLD);

  const allowOverflow = className?.includes("overflow-visible") ?? false;

  return (
    <div
      className={[
        "relative rounded-2xl",
        allowOverflow ? "overflow-visible" : "overflow-hidden",
        className ?? ""
      ].join(" ")}
    >
      {onSwipeLeft && (
        <div
          className={[
            "absolute inset-0 flex items-center justify-end rounded-2xl px-6",
            onSwipeLeft.bgClassName ?? "bg-accent"
          ].join(" ")}
          style={{ opacity: leftRevealRatio }}
          aria-hidden="true"
        >
          {onSwipeLeft.icon}
        </div>
      )}
      {onSwipeRight && (
        <div
          className={[
            "absolute inset-0 flex items-center justify-start rounded-2xl px-6",
            onSwipeRight.bgClassName ?? "bg-accent"
          ].join(" ")}
          style={{ opacity: rightRevealRatio }}
          aria-hidden="true"
        >
          {onSwipeRight.icon}
        </div>
      )}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        style={{ transform: `translateX(${dragX}px)`, touchAction: "pan-y" }}
        className={["relative", isDragging ? "" : "transition-transform duration-200 ease-out"].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
