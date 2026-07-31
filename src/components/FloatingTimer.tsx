import { formatRemaining } from "../domain/timer";
import { en } from "../i18n/en";
import { startWindowDragging } from "../services/platform";
import type { Session } from "../types";

interface FloatingTimerProps {
  session: Session | null;
  remainingSeconds: number;
  progress: number;
}

export function FloatingTimer({ session, remainingSeconds, progress }: FloatingTimerProps) {
  const displayTime = session ? formatRemaining(remainingSeconds) : "--:--";
  const displayedProgress = session ? progress : 0;
  return (
    <main
      className="floating-shell"
      data-tauri-drag-region
      aria-label={session ? `${en.active}: ${session.type === "focus" ? en.focus : en.break}` : en.noActiveSession}
      onMouseDown={() => void startWindowDragging()}
    >
      <strong className="floating-countdown" aria-live="polite">
        {displayTime}
      </strong>
      <div
        className="floating-progress"
        role="progressbar"
        aria-label={en.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayedProgress * 100)}
      >
        <span style={{ transform: `scaleX(${displayedProgress})` }} />
      </div>
    </main>
  );
}
