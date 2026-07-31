PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
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

CREATE UNIQUE INDEX IF NOT EXISTS one_active_session
  ON sessions(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS sessions_completion_lookup
  ON sessions(type, status, completed_at);

CREATE TABLE IF NOT EXISTS settings (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  focus_duration_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (focus_duration_minutes BETWEEN 1 AND 180),
  break_duration_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (break_duration_minutes BETWEEN 1 AND 60),
  alarm_enabled INTEGER NOT NULL DEFAULT 1 CHECK (alarm_enabled IN (0, 1)),
  alarm_sound TEXT NOT NULL DEFAULT 'gentle'
    CHECK (alarm_sound IN ('gentle', 'bright', 'wood')),
  notifications_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (notifications_enabled IN (0, 1)),
  floating_timer_always_on_top INTEGER NOT NULL DEFAULT 1
    CHECK (floating_timer_always_on_top IN (0, 1)),
  theme TEXT NOT NULL DEFAULT 'system'
    CHECK (theme IN ('system', 'light', 'dark')),
  backup_directory TEXT
);

INSERT OR IGNORE INTO settings(singleton) VALUES (1);

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
