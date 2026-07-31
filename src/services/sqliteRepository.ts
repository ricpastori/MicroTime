import Database from "@tauri-apps/plugin-sql";
import { validateBackup } from "../domain/backup";
import { DEFAULT_SETTINGS, type BackupPayload, type Session, type Settings } from "../types";
import type { Repository } from "./repository";

interface SessionRow {
  id: string;
  type: Session["type"];
  status: Session["status"];
  started_at: string;
  planned_end_at: string;
  completed_at: string | null;
  planned_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

interface SettingsRow {
  focus_duration_minutes: number;
  break_duration_minutes: number;
  alarm_enabled: number;
  alarm_sound: Settings["alarmSound"];
  notifications_enabled: number;
  floating_timer_always_on_top: number;
  theme: Settings["theme"];
  backup_directory: string | null;
}

interface ValueRow {
  value: string;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    startedAt: row.started_at,
    plannedEndAt: row.planned_end_at,
    completedAt: row.completed_at,
    plannedDurationSeconds: row.planned_duration_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettings(row: SettingsRow | undefined): Settings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    focusDurationMinutes: row.focus_duration_minutes,
    breakDurationMinutes: row.break_duration_minutes,
    alarmEnabled: row.alarm_enabled === 1,
    alarmSound: row.alarm_sound,
    notificationsEnabled: row.notifications_enabled === 1,
    floatingTimerAlwaysOnTop: row.floating_timer_always_on_top === 1,
    theme: row.theme,
    backupDirectory: row.backup_directory,
  };
}

function settingsParameters(settings: Settings): (string | number | null)[] {
  return [
    settings.focusDurationMinutes,
    settings.breakDurationMinutes,
    settings.alarmEnabled ? 1 : 0,
    settings.alarmSound,
    settings.notificationsEnabled ? 1 : 0,
    settings.floatingTimerAlwaysOnTop ? 1 : 0,
    settings.theme,
    settings.backupDirectory,
  ];
}

function sessionParameters(session: Session): (string | number | null)[] {
  return [
    session.id,
    session.type,
    session.status,
    session.startedAt,
    session.plannedEndAt,
    session.completedAt,
    session.plannedDurationSeconds,
    session.createdAt,
    session.updatedAt,
  ];
}

class SqliteRepository implements Repository {
  constructor(private readonly database: Database) {}

  async getSettings(): Promise<Settings> {
    const rows = await this.database.select<SettingsRow[]>(
      `SELECT focus_duration_minutes, break_duration_minutes, alarm_enabled, alarm_sound,
              notifications_enabled, floating_timer_always_on_top, theme, backup_directory
       FROM settings WHERE singleton = 1`,
    );
    return mapSettings(rows[0]);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.database.execute(
      `INSERT INTO settings (
         singleton, focus_duration_minutes, break_duration_minutes, alarm_enabled, alarm_sound,
         notifications_enabled, floating_timer_always_on_top, theme, backup_directory
       ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(singleton) DO UPDATE SET
         focus_duration_minutes = excluded.focus_duration_minutes,
         break_duration_minutes = excluded.break_duration_minutes,
         alarm_enabled = excluded.alarm_enabled,
         alarm_sound = excluded.alarm_sound,
         notifications_enabled = excluded.notifications_enabled,
         floating_timer_always_on_top = excluded.floating_timer_always_on_top,
         theme = excluded.theme,
         backup_directory = excluded.backup_directory`,
      settingsParameters(settings),
    );
  }

  async insertSession(session: Session): Promise<void> {
    await this.database.execute(
      `INSERT INTO sessions (
         id, type, status, started_at, planned_end_at, completed_at,
         planned_duration_seconds, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      sessionParameters(session),
    );
  }

  async getActiveSession(): Promise<Session | null> {
    const rows = await this.database.select<SessionRow[]>(
      `SELECT id, type, status, started_at, planned_end_at, completed_at,
              planned_duration_seconds, created_at, updated_at
       FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async completeSession(id: string, completedAt: string): Promise<boolean> {
    const result = await this.database.execute(
      `UPDATE sessions
       SET status = 'completed', completed_at = $1, updated_at = $1
       WHERE id = $2 AND status = 'active'`,
      [completedAt, id],
    );
    return result.rowsAffected === 1;
  }

  async interruptSession(id: string, interruptedAt: string): Promise<boolean> {
    const result = await this.database.execute(
      `UPDATE sessions
       SET status = 'interrupted', completed_at = NULL, updated_at = $1
       WHERE id = $2 AND status = 'active'`,
      [interruptedAt, id],
    );
    return result.rowsAffected === 1;
  }

  async listSessions(): Promise<Session[]> {
    const rows = await this.database.select<SessionRow[]>(
      `SELECT id, type, status, started_at, planned_end_at, completed_at,
              planned_duration_seconds, created_at, updated_at
       FROM sessions ORDER BY started_at ASC`,
    );
    return rows.map(mapSession);
  }

  async exportData(exportedAt = new Date().toISOString()): Promise<BackupPayload> {
    return {
      format: "microtime-backup",
      version: 1,
      exportedAt,
      settings: await this.getSettings(),
      sessions: await this.listSessions(),
    };
  }

  async importData(backup: BackupPayload): Promise<void> {
    const validated = validateBackup(backup);

    // Data is prepared in staging tables so the live database remains intact
    // if validation or loading fails.
    await this.database.execute("DELETE FROM import_sessions_staging");
    await this.database.execute("DELETE FROM import_settings_staging");

    for (const session of validated.sessions) {
      await this.database.execute(
        `INSERT INTO import_sessions_staging (
           id, type, status, started_at, planned_end_at, completed_at,
           planned_duration_seconds, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        sessionParameters(session),
      );
    }

    await this.database.execute(
      `INSERT INTO import_settings_staging (
         singleton, focus_duration_minutes, break_duration_minutes, alarm_enabled, alarm_sound,
         notifications_enabled, floating_timer_always_on_top, theme, backup_directory
       ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)`,
      settingsParameters(validated.settings),
    );

    const staged = await this.database.select<Array<{ count: number }>>(
      "SELECT COUNT(*) AS count FROM import_sessions_staging",
    );
    if (Number(staged[0]?.count ?? -1) !== validated.sessions.length) {
      throw new Error("The staging load is incomplete");
    }

    // The associated trigger applies settings and sessions in a single SQLite
    // transaction, making the restore atomic.
    await this.database.execute(
      `INSERT INTO app_metadata(key, value) VALUES ('apply_import', $1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [validated.exportedAt],
    );
  }

  async getMetadata(key: string): Promise<string | null> {
    const rows = await this.database.select<ValueRow[]>("SELECT value FROM app_metadata WHERE key = $1", [key]);
    return rows[0]?.value ?? null;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    await this.database.execute(
      `INSERT INTO app_metadata(key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }
}

export async function openSqliteRepository(): Promise<Repository> {
  return new SqliteRepository(await Database.load("sqlite:microtime.db"));
}
