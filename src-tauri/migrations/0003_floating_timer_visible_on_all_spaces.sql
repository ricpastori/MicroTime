ALTER TABLE settings
  ADD COLUMN floating_timer_visible_on_all_spaces INTEGER NOT NULL DEFAULT 0
  CHECK (floating_timer_visible_on_all_spaces IN (0, 1));

ALTER TABLE import_settings_staging
  ADD COLUMN floating_timer_visible_on_all_spaces INTEGER NOT NULL DEFAULT 0
  CHECK (floating_timer_visible_on_all_spaces IN (0, 1));

DROP TRIGGER IF EXISTS apply_staged_import_on_insert;
DROP TRIGGER IF EXISTS apply_staged_import_on_update;

CREATE TRIGGER apply_staged_import_on_insert
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
    floating_timer_visible_on_all_spaces = (SELECT floating_timer_visible_on_all_spaces FROM import_settings_staging WHERE singleton = 1),
    theme = (SELECT theme FROM import_settings_staging WHERE singleton = 1),
    backup_directory = (SELECT backup_directory FROM import_settings_staging WHERE singleton = 1)
  WHERE singleton = 1;
  DELETE FROM import_sessions_staging;
  DELETE FROM import_settings_staging;
END;

CREATE TRIGGER apply_staged_import_on_update
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
    floating_timer_visible_on_all_spaces = (SELECT floating_timer_visible_on_all_spaces FROM import_settings_staging WHERE singleton = 1),
    theme = (SELECT theme FROM import_settings_staging WHERE singleton = 1),
    backup_directory = (SELECT backup_directory FROM import_settings_staging WHERE singleton = 1)
  WHERE singleton = 1;
  DELETE FROM import_sessions_staging;
  DELETE FROM import_settings_staging;
END;
