import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { Capacitor } from "@capacitor/core";
import { getThemePreference, resolveTheme, type ThemeMode } from "../services/settings";
import splashDefault from "../assets/lottie/splash.json";

interface Props { onFinish: () => void; }

const SPLASHES: Record<ThemeMode, object> = {
  crimson: splashDefault, orange: splashDefault, amber: splashDefault, purple: splashDefault, grey: splashDefault
};

export function SplashScreen({ onFinish }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: AnimationItem | null = null;
    let finished = false;
    let fallbackId: number | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      const el = rootRef.current;
      if (el) {
        el.style.opacity = "0";
        window.setTimeout(onFinish, 320);
      } else onFinish();
    };

    const start = async () => {
      let theme: ThemeMode = "crimson";
      try { theme = resolveTheme(await getThemePreference()); } catch { /* use default */ }

      if (Capacitor.isNativePlatform()) {
        import("@capacitor/splash-screen")
          .then(({ SplashScreen: NativeSplashScreen }) => NativeSplashScreen.hide())
          .catch(() => {});
      }

      if (containerRef.current) {
        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: false,
          autoplay: true,
          animationData: SPLASHES[theme] ?? splashDefault,
        });
        anim.addEventListener("complete", finish);
      }
    };

    start();
    fallbackId = window.setTimeout(finish, 3200);
    return () => { anim?.destroy(); if (fallbackId) window.clearTimeout(fallbackId); };
  }, [onFinish]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-5 bg-[#12080a] transition-opacity duration-300 ease-out"
    >
      <div ref={containerRef} className="h-36 w-36" />
      <div className="splash-label flex flex-col items-center gap-2">
        <span className="text-[15px] font-medium tracking-[-0.01em] text-ink">Habitude</span>
        <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted">Small steps, every day</span>
      </div>
    </div>
  );
}
