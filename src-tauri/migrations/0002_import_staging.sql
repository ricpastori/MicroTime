CREATE TABLE IF NOT EXISTS import_sessions_staging (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('focus', 'break')),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'interrupted')),
  started_at TEXT NOT NULL,
  planned_end_at TEXT NOT NULL,
  completed_at TEXT,
  planned_duration_seconds INTEGER NOT NULL CHECK (planned_duration_seconds > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_settings_staging (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  focus_duration_minutes INTEGER NOT NULL CHECK (focus_duration_minutes BETWEEN 1 AND 180),
  break_duration_minutes INTEGER NOT NULL CHECK (break_duration_minutes BETWEEN 1 AND 60),
  alarm_enabled INTEGER NOT NULL CHECK (alarm_enabled IN (0, 1)),
  alarm_sound TEXT NOT NULL CHECK (alarm_sound IN ('gentle', 'bright', 'wood')),
  notifications_enabled INTEGER NOT NULL CHECK (notifications_enabled IN (0, 1)),
  floating_timer_always_on_top INTEGER NOT NULL CHECK (floating_timer_always_on_top IN (0, 1)),
  theme TEXT NOT NULL CHECK (theme IN ('system', 'light', 'dark')),
  backup_directory TEXT
);

CREATE TRIGGER IF NOT EXISTS apply_staged_import_on_insert
AFTER INSERT ON app_metadata
WHEN NEW.key = 'apply_import'
BEGIN
  DELETE FROM sessions;
  INSERT INTO sessions
  SELECT id, type, status, started_at, planned_end_at, completed_at,
         planned_duration_seconds, created_at, updated_at
  FROM import_sessions_staging;
  UPDATE settings SET
    focus_duration_minutes = (SELECT focus_duration_minutes FROM import_settings_staging WHERE singleton = 1),
    break_duration_minutes = (SELECT break_duration_minutes FROM import_settings_staging WHERE singleton = 1),
    alarm_enabled = (SELECT alarm_enabled FROM import_settings_staging WHERE singleton = 1),
    alarm_sound = (SELECT alarm_sound FROM import_settings_staging WHERE singleton = 1),
    notifications_enabled = (SELECT notifications_enabled FROM import_settings_staging WHERE singleton = 1),
    floating_timer_always_on_top = (SELECT floating_timer_always_on_top FROM import_settings_staging WHERE singleton = 1),
    theme = (SELECT theme FROM import_settings_staging WHERE singleton = 1),
    backup_directory = (SELECT backup_directory FROM import_settings_staging WHERE singleton = 1)
  WHERE singleton = 1;
  DELETE FROM import_sessions_staging;
  DELETE FROM import_settings_staging;
END;

CREATE TRIGGER IF NOT EXISTS apply_staged_import_on_update
AFTER UPDATE OF value ON app_metadata
WHEN NEW.key = 'apply_import'
BEGIN
  DELETE FROM sessions;
  INSERT INTO sessions
  SELECT id, type, status, started_at, planned_end_at, completed_at,
         planned_duration_seconds, created_at, updated_at
  FROM import_sessions_staging;
  UPDATE settings SET
    focus_duration_minutes = (SELECT focus_duration_minutes FROM import_settings_staging WHERE singleton = 1),
    break_duration_minutes = (SELECT break_duration_minutes FROM import_settings_staging WHERE singleton = 1),
    alarm_enabled = (SELECT alarm_enabled FROM import_settings_staging WHERE singleton = 1),
    alarm_sound = (SELECT alarm_sound FROM import_settings_staging WHERE singleton = 1),
    notifications_enabled = (SELECT notifications_enabled FROM import_settings_staging WHERE singleton = 1),
    floating_timer_always_on_top = (SELECT floating_timer_always_on_top FROM import_settings_staging WHERE singleton = 1),
    theme = (SELECT theme FROM import_settings_staging WHERE singleton = 1),
    backup_directory = (SELECT backup_directory FROM import_settings_staging WHERE singleton = 1)
  WHERE singleton = 1;
  DELETE FROM import_sessions_staging;
  DELETE FROM import_settings_staging;
END;
