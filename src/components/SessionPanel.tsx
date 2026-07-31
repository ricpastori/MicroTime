import { en } from "../i18n/en";
import type { Session, SessionType } from "../types";
import { formatRemaining } from "../domain/timer";
import { CheckIcon, PlayIcon, StopIcon } from "./Icons";

interface SessionPanelProps {
  activeSession: Session | null;
  finishedType: SessionType | null;
  remainingSeconds: number;
  progress: number;
  focusMinutes: number;
  breakMinutes: number;
  onStart: (type: SessionType) => void;
  onInterrupt: () => void;
}

export function SessionPanel({
  activeSession,
  finishedType,
  remainingSeconds,
  progress,
  focusMinutes,
  breakMinutes,
  onStart,
  onInterrupt,
}: SessionPanelProps) {
  if (activeSession) {
    const label = activeSession.type === "focus" ? en.focus : en.break;
    return (
      <section className="session-card session-card--active" aria-live="polite">
        <div className="session-active-copy">
          <span className="status-pill">
            <i aria-hidden="true" />
            {en.active} · {label}
          </span>
          <p className="timer-label">{en.remaining}</p>
          <strong className="main-timer">{formatRemaining(remainingSeconds)}</strong>
        </div>
        <div className="session-progress-block">
          <div
            className="progress-track"
            role="progressbar"
            aria-label={en.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
          <div className="progress-meta">
            <span>{en.progressComplete(Math.round(progress * 100))}</span>
            <span>{en.totalMinutes(Math.round(activeSession.plannedDurationSeconds / 60))}</span>
          </div>
          <button className="button button--quiet button--danger" type="button" onClick={onInterrupt}>
            <StopIcon />
            {en.stop}
          </button>
        </div>
      </section>
    );
  }

  if (finishedType) {
    const isFocus = finishedType === "focus";
    return (
      <section className="session-card session-card--finished" aria-live="polite">
        <div className="finished-mark">
          <CheckIcon />
        </div>
        <div className="finished-copy">
          <h2>{isFocus ? en.focusDone : en.breakDone}</h2>
        </div>
        <div className="finished-actions">
          <button className="button button--primary" type="button" onClick={() => onStart("focus")}>
            <PlayIcon />
            {en.newFocus}
          </button>
          {isFocus && (
            <button className="button button--secondary" type="button" onClick={() => onStart("break")}>
              {en.startBreak}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="session-card session-card--ready">
      <h2>{en.readyTitle}</h2>
      <div className="session-options">
        <button className="start-option start-option--focus" type="button" onClick={() => onStart("focus")}>
          <PlayIcon />
          <strong>{en.startFocus}</strong>
          <small>{en.durationMinutes(focusMinutes)}</small>
        </button>
        <button className="start-option" type="button" onClick={() => onStart("break")}>
          <PlayIcon />
          <strong>{en.startBreak}</strong>
          <small>{en.durationMinutes(breakMinutes)}</small>
        </button>
      </div>
    </section>
  );
}
