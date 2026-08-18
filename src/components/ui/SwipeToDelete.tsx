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
 * This is a simple gesture sensor: the row tracks the finger/cursor while
 * dragging, and once the finger LIFTS past THRESHOLD in a direction with
 * a registered action, that action fires. Pointer capture keeps the
 * gesture from being dropped if the cursor moves quickly, which matters
 * most for mouse/desktop dragging.
 *
 * Firing only happens on release (not mid-drag): on touch devices,
 * firing while the finger is still down would mount the confirm
 * dialog's full-screen backdrop underneath that same finger, and the
 * eventual lift-off gets turned into a synthetic click on the backdrop
 * — instantly dismissing the dialog before the user ever sees it.
 */
export function SwipeToDelete({ children, className, onSwipeLeft, onSwipeRight }: Props) {
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const fired = useRef(false);
  const touchActive = useRef(false);
  const confirm = useConfirm();

  function resetGesture() {
    pointerId.current = null;
    touchActive.current = false;
    axis.current = null;
    setIsDragging(false);
  }

  async function fireAction(action: SwipeAction, direction: -1 | 1) {
    fired.current = true;
    resetGesture();
    const finalX = direction * THRESHOLD;
    dragXRef.current = finalX;
    setDragX(finalX);

    const requireConfirm = action.requireConfirm ?? true;
    let ok = true;
    if (requireConfirm) {
      ok = await confirm({
        title: "Delete Confirmation",
        message: `${action.confirmMessage ?? "Are you sure you want to delete this item?"}\n\nThis can't be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        type: "danger"
      });
    }
    if (ok) await action.onTrigger();

    dragXRef.current = 0;
    setDragX(0);
    fired.current = false;
  }

  function beginGesture(clientX: number, clientY: number) {
    startX.current = clientX;
    startY.current = clientY;
    axis.current = null;
    fired.current = false;
    dragXRef.current = 0;
    setDragX(0);
  }

  function moveGesture(clientX: number, clientY: number, prevent: () => void) {
    if (fired.current) return;

    const dx = clientX - startX.current;
    const dy = clientY - startY.current;

    if (axis.current === null) {
      // Ignore tiny finger jitter.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";

      if (axis.current === "x") {
        setIsDragging(true);
        // Once horizontal intent is established, take control from the
        // browser/WebView so the gesture cannot be turned into scrolling.
        prevent();
      }
    }

    if (axis.current !== "x") return;

    prevent();
    const min = onSwipeLeft ? -THRESHOLD : 0;
    const max = onSwipeRight ? THRESHOLD : 0;
    const clamped = Math.min(max, Math.max(min, dx));
    dragXRef.current = clamped;
    setDragX(clamped);
  }

  function endGesture() {
    if (fired.current) return;

    const finalDragX = dragXRef.current;
    resetGesture();

    if (finalDragX <= -THRESHOLD && onSwipeLeft) {
      void fireAction(onSwipeLeft, -1);
    } else if (finalDragX >= THRESHOLD && onSwipeRight) {
      void fireAction(onSwipeRight, 1);
    } else {
      dragXRef.current = 0;
      setDragX(0);
    }
  }

  function cancelGesture() {
    if (fired.current) return;
    resetGesture();
    dragXRef.current = 0;
    setDragX(0);
  }

  // Pointer events are used for desktop/mouse and newer WebViews.
  function handlePointerDown(e: ReactPointerEvent) {
    // Android touch is handled by the explicit touch* handlers below.
    // Ignoring touch pointer events here prevents the same finger gesture
    // from being processed twice by Pointer Events and Touch Events.
    if (e.pointerType === "touch") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId.current = e.pointerId;
    beginGesture(e.clientX, e.clientY);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (e.pointerType === "touch") return;
    if (pointerId.current !== e.pointerId) return;
    moveGesture(e.clientX, e.clientY, () => e.preventDefault());

    if (axis.current === "x" && !touchActive.current &&
        !e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerUp(e: ReactPointerEvent) {
    if (e.pointerType === "touch") return;
    if (pointerId.current !== e.pointerId) return;
    endGesture();
  }

  function handlePointerCancel(e: ReactPointerEvent) {
    if (e.pointerType === "touch") return;
    if (pointerId.current !== e.pointerId) return;
    cancelGesture();
  }

  // Explicit touch fallback. Capacitor Android WebView versions can behave
  // differently from desktop Chrome with pointer events, so the actual phone
  // gesture is also handled through touchstart/touchmove/touchend.
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchActive.current = true;
    beginGesture(e.touches[0].clientX, e.touches[0].clientY);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchActive.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    moveGesture(touch.clientX, touch.clientY, () => e.preventDefault());
  }

  function handleTouchEnd() {
    if (!touchActive.current) return;
    endGesture();
  }

  function handleTouchCancel() {
    if (!touchActive.current) return;
    cancelGesture();
  }

  const leftRevealRatio = Math.min(1, Math.max(0, -dragX) / THRESHOLD);
  const rightRevealRatio = Math.min(1, Math.max(0, dragX) / THRESHOLD);
  const allowOverflow = className?.includes("overflow-visible") ?? false;

  return (
    <div
      className={["relative rounded-2xl", allowOverflow ? "overflow-visible" : "overflow-hidden", className ?? ""].join(" ")}
    >
      {onSwipeLeft && (
        <div
          className={["absolute inset-0 flex items-center justify-end rounded-2xl px-6", onSwipeLeft.bgClassName ?? "bg-accent"].join(" ")}
          style={{ opacity: leftRevealRatio }}
          aria-hidden="true"
        >
          {onSwipeLeft.icon}
        </div>
      )}
      {onSwipeRight && (
        <div
          className={["absolute inset-0 flex items-center justify-start rounded-2xl px-6", onSwipeRight.bgClassName ?? "bg-accent"].join(" ")}
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
        onPointerCancel={handlePointerCancel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          transform: `translateX(${dragX}px)`,
          // Allow normal vertical page scrolling until horizontal intent is
          // detected. Touch handlers then call preventDefault for the swipe.
          touchAction: "pan-y"
        }}
        className={["relative select-none", isDragging ? "" : "transition-transform duration-200 ease-out"].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
