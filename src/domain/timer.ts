import type { Session, TimerSnapshot } from "../types";

export function calculateRemainingSeconds(plannedEndAt: string, nowMs = Date.now()): number {
  const endMs = Date.parse(plannedEndAt);
  if (!Number.isFinite(endMs)) {
    throw new Error("plannedEndAt non valido");
  }
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

export function calculateProgress(session: Session, nowMs = Date.now()): number {
  const remaining = calculateRemainingSeconds(session.plannedEndAt, nowMs);
  if (session.plannedDurationSeconds <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, 1 - remaining / session.plannedDurationSeconds));
}

export function localTimerSnapshot(durationSeconds: number, plannedEndAt?: string, nowMs = Date.now()): TimerSnapshot {
  const end = plannedEndAt ?? new Date(nowMs + durationSeconds * 1000).toISOString();
  return {
    nowUtc: new Date(nowMs).toISOString(),
    plannedEndAt: end,
    remainingSeconds: calculateRemainingSeconds(end, nowMs),
  };
}

export function formatRemaining(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
