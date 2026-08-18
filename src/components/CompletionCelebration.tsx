import { useEffect, useState } from "react";
import { COMPLETION_CELEBRATION_EVENT, type CompletionCelebrationDetail } from "../utils/completionCelebration";

type Props = { theme: string };

type State = CompletionCelebrationDetail & { id: number };

export function CompletionCelebration({ theme }: Props) {
  const [celebration, setCelebration] = useState<State | null>(null);

  useEffect(() => {
    const onCelebrate = (event: Event) => {
      const detail = (event as CustomEvent<CompletionCelebrationDetail>).detail;
      if (!detail || detail.theme !== theme) return;
      setCelebration({ ...detail, id: Date.now() });
    };
    window.addEventListener(COMPLETION_CELEBRATION_EVENT, onCelebrate);
    return () => window.removeEventListener(COMPLETION_CELEBRATION_EVENT, onCelebrate);
  }, [theme]);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 2200);
    return () => window.clearTimeout(timer);
  }, [celebration?.id]);

  if (!celebration) return null;

  if (celebration.theme === "halloween") {
    return (
      <div key={celebration.id} className="completion-celebration halloween-celebration" aria-hidden="true">
        <div className="flying-bat bat-one">🦇</div>
        <div className="flying-bat bat-two">🦇</div>
        <div className="halloween-particle p1">✦</div>
        <div className="halloween-particle p2">✦</div>
        <div className="halloween-particle p3">•</div>
        <div className="halloween-particle p4">•</div>
      </div>
    );
  }

  return (
    <div key={celebration.id} className="completion-celebration christmas-celebration" aria-hidden="true">
      <div className="flying-santa">🎅</div>
      <div className="christmas-snow snow1">❄</div>
      <div className="christmas-snow snow2">❄</div>
      <div className="christmas-snow snow3">✦</div>
      <div className="christmas-snow snow4">❄</div>
      <div className="christmas-snow snow5">•</div>
    </div>
  );
}
