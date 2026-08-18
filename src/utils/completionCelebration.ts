export type CompletionKind = "habit" | "task";
export type CompletionTheme = "halloween" | "christmas";

export interface CompletionCelebrationDetail {
  kind: CompletionKind;
  theme: CompletionTheme;
}

export const COMPLETION_CELEBRATION_EVENT = "habitude:completion-celebration";

export function fireCompletionCelebration(kind: CompletionKind, theme: string) {
  if (theme !== "halloween" && theme !== "christmas") return;
  window.dispatchEvent(
    new CustomEvent<CompletionCelebrationDetail>(COMPLETION_CELEBRATION_EVENT, {
      detail: { kind, theme }
    })
  );
}
