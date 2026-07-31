import { calculateRemainingSeconds, localTimerSnapshot } from "./timer";
import type { Repository } from "../services/repository";
import type { Session, SessionType, TimerSnapshot } from "../types";

export async function startSession(
  repository: Repository,
  type: SessionType,
  durationSeconds: number,
  snapshot: TimerSnapshot = localTimerSnapshot(durationSeconds),
  id?: string,
): Promise<Session> {
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Duration must be a positive integer");
  }
  const session: Session = {
    id: id ?? crypto.randomUUID(),
    type,
    status: "active",
    startedAt: snapshot.nowUtc,
    plannedEndAt: snapshot.plannedEndAt,
    completedAt: null,
    plannedDurationSeconds: durationSeconds,
    createdAt: snapshot.nowUtc,
    updatedAt: snapshot.nowUtc,
  };
  await repository.insertSession(session);
  return session;
}

export async function restoreActiveSession(
  repository: Repository,
  nowMs = Date.now(),
): Promise<{ session: Session | null; completedDuringRestore: Session | null }> {
  const session = await repository.getActiveSession();
  if (!session) {
    return { session: null, completedDuringRestore: null };
  }
  if (calculateRemainingSeconds(session.plannedEndAt, nowMs) > 0) {
    return { session, completedDuringRestore: null };
  }
  const completedAt = new Date(Math.max(nowMs, Date.parse(session.plannedEndAt))).toISOString();
  const completed = await repository.completeSession(session.id, completedAt);
  return { session: null, completedDuringRestore: completed ? session : null };
}
