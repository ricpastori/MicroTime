import {
  ALARM_SOUNDS,
  SESSION_STATUSES,
  SESSION_TYPES,
  THEMES,
  type BackupPayload,
  type Session,
  type Settings,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableIsoTimestamp(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.focusDurationMinutes) &&
    Number(value.focusDurationMinutes) >= 1 &&
    Number(value.focusDurationMinutes) <= 180 &&
    Number.isInteger(value.breakDurationMinutes) &&
    Number(value.breakDurationMinutes) >= 1 &&
    Number(value.breakDurationMinutes) <= 60 &&
    typeof value.alarmEnabled === "boolean" &&
    typeof value.alarmSound === "string" &&
    ALARM_SOUNDS.includes(value.alarmSound as (typeof ALARM_SOUNDS)[number]) &&
    typeof value.notificationsEnabled === "boolean" &&
    typeof value.floatingTimerAlwaysOnTop === "boolean" &&
    typeof value.floatingTimerVisibleOnAllSpaces === "boolean" &&
    typeof value.theme === "string" &&
    THEMES.includes(value.theme as (typeof THEMES)[number]) &&
    (value.backupDirectory === null || typeof value.backupDirectory === "string")
  );
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length >= 8 &&
    typeof value.type === "string" &&
    SESSION_TYPES.includes(value.type as (typeof SESSION_TYPES)[number]) &&
    typeof value.status === "string" &&
    SESSION_STATUSES.includes(value.status as (typeof SESSION_STATUSES)[number]) &&
    isIsoTimestamp(value.startedAt) &&
    isIsoTimestamp(value.plannedEndAt) &&
    isNullableIsoTimestamp(value.completedAt) &&
    Number.isInteger(value.plannedDurationSeconds) &&
    Number(value.plannedDurationSeconds) > 0 &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

export function validateBackup(value: unknown): BackupPayload {
  if (
    !isRecord(value) ||
    value.format !== "microtime-backup" ||
    value.version !== 1 ||
    !isIsoTimestamp(value.exportedAt) ||
    !isSettings(value.settings) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isSession)
  ) {
    throw new Error("Invalid MicroTime backup");
  }

  const ids = new Set<string>();
  let activeCount = 0;
  for (const session of value.sessions) {
    if (ids.has(session.id)) {
      throw new Error("The backup contains duplicate sessions");
    }
    ids.add(session.id);
    if (session.status === "active") activeCount += 1;
    if (session.status === "completed" && !session.completedAt) {
      throw new Error("A completed session has no completion timestamp");
    }
    if (session.status !== "completed" && session.completedAt !== null) {
      throw new Error("An incomplete session has a completion timestamp");
    }
  }
  if (activeCount > 1) throw new Error("The backup contains more than one active session");
  return value as unknown as BackupPayload;
}

export function serializeBackup(payload: BackupPayload): string {
  return `${JSON.stringify(validateBackup(payload), null, 2)}\n`;
}
