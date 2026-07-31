export const SESSION_TYPES = ["focus", "break"] as const;
export const SESSION_STATUSES = ["active", "completed", "interrupted"] as const;
export const THEMES = ["system", "light", "dark"] as const;
export const ALARM_SOUNDS = ["gentle", "bright", "wood"] as const;

export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type Theme = (typeof THEMES)[number];
export type AlarmSound = (typeof ALARM_SOUNDS)[number];

export interface Session {
  id: string;
  type: SessionType;
  status: SessionStatus;
  startedAt: string;
  plannedEndAt: string;
  completedAt: string | null;
  plannedDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  alarmEnabled: boolean;
  alarmSound: AlarmSound;
  notificationsEnabled: boolean;
  floatingTimerAlwaysOnTop: boolean;
  theme: Theme;
  backupDirectory: string | null;
}

export interface BackupPayload {
  format: "microtime-backup";
  version: 1;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
}

export interface DayActivity {
  date: string;
  count: number;
}

export interface TimerSnapshot {
  nowUtc: string;
  plannedEndAt: string;
  remainingSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  focusDurationMinutes: 15,
  breakDurationMinutes: 5,
  alarmEnabled: true,
  alarmSound: "gentle",
  notificationsEnabled: true,
  floatingTimerAlwaysOnTop: true,
  theme: "system",
  backupDirectory: null,
};
