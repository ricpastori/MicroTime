import { useEffect, useRef, useState } from "react";
import { en } from "../i18n/en";
import { chooseBackupDirectory, playAlarm } from "../services/platform";
import { ALARM_SOUNDS, type Settings } from "../types";
import { CloseIcon, DownloadIcon, FolderIcon, SoundIcon, UploadIcon } from "./Icons";

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onUpdate: (settings: Settings) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: () => Promise<void>;
}

const soundNames: Record<Settings["alarmSound"], string> = {
  gentle: en.alarmSounds.gentle,
  bright: en.alarmSounds.bright,
  wood: en.alarmSounds.wood,
};

export function SettingsDialog({ open, settings, onClose, onUpdate, onExport, onImport }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const update = async (patch: Partial<Settings>) => {
    await onUpdate({ ...settings, ...patch });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const chooseDirectory = async () => {
    const directory = await chooseBackupDirectory();
    if (directory) await update({ backupDirectory: directory });
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <header className="settings-header">
          <div>
            <h2 id="settings-title">{en.settingsTitle}</h2>
          </div>
          <div className="settings-header-actions">
            <span className={`saved-indicator ${saved ? "saved-indicator--visible" : ""}`} aria-live="polite">
              {saved ? `✓ ${en.saved}` : ""}
            </span>
            <button className="icon-button" type="button" aria-label={en.closeSettings} onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="settings-scroll">
          <section className="settings-section settings-section--durations" aria-labelledby="durations-title">
            <h3 className="settings-section-title" id="durations-title">
              {en.durationsSection}
            </h3>
            <div className="duration-grid">
              <div className="field-card">
                <label htmlFor="focus-duration">{en.focusDuration}</label>
                <div className="number-field">
                  <div className="number-input">
                    <input
                      id="focus-duration"
                      type="number"
                      min={1}
                      max={180}
                      value={settings.focusDurationMinutes}
                      onChange={(event) =>
                        void update({
                          focusDurationMinutes: Math.min(180, Math.max(1, Number(event.target.value) || 1)),
                        })
                      }
                    />
                    <span className="number-stepper">
                      <button
                        type="button"
                        aria-label={`${en.increase} ${en.focusDuration}`}
                        disabled={settings.focusDurationMinutes >= 180}
                        onClick={() =>
                          void update({ focusDurationMinutes: Math.min(180, settings.focusDurationMinutes + 1) })
                        }
                      >
                        <span className="stepper-arrow stepper-arrow--up" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${en.decrease} ${en.focusDuration}`}
                        disabled={settings.focusDurationMinutes <= 1}
                        onClick={() =>
                          void update({ focusDurationMinutes: Math.max(1, settings.focusDurationMinutes - 1) })
                        }
                      >
                        <span className="stepper-arrow stepper-arrow--down" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  <small>{en.minutes}</small>
                </div>
              </div>
              <div className="field-card">
                <label htmlFor="break-duration">{en.breakDuration}</label>
                <div className="number-field">
                  <div className="number-input">
                    <input
                      id="break-duration"
                      type="number"
                      min={1}
                      max={60}
                      value={settings.breakDurationMinutes}
                      onChange={(event) =>
                        void update({
                          breakDurationMinutes: Math.min(60, Math.max(1, Number(event.target.value) || 1)),
                        })
                      }
                    />
                    <span className="number-stepper">
                      <button
                        type="button"
                        aria-label={`${en.increase} ${en.breakDuration}`}
                        disabled={settings.breakDurationMinutes >= 60}
                        onClick={() =>
                          void update({ breakDurationMinutes: Math.min(60, settings.breakDurationMinutes + 1) })
                        }
                      >
                        <span className="stepper-arrow stepper-arrow--up" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${en.decrease} ${en.breakDuration}`}
                        disabled={settings.breakDurationMinutes <= 1}
                        onClick={() =>
                          void update({ breakDurationMinutes: Math.max(1, settings.breakDurationMinutes - 1) })
                        }
                      >
                        <span className="stepper-arrow stepper-arrow--down" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  <small>{en.minutes}</small>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="alerts-title">
            <h3 className="settings-section-title" id="alerts-title">
              {en.alertsSection}
            </h3>
            <label className="setting-row">
              <span>
                <strong>{en.alarm}</strong>
              </span>
              <input
                className="switch"
                type="checkbox"
                checked={settings.alarmEnabled}
                onChange={(event) => void update({ alarmEnabled: event.target.checked })}
              />
            </label>
            <div className="setting-row">
              <label htmlFor="alarm-sound">
                <strong>{en.alarmSound}</strong>
              </label>
              <div className="inline-control alarm-controls">
                <span className="select-wrap">
                  <select
                    id="alarm-sound"
                    value={settings.alarmSound}
                    disabled={!settings.alarmEnabled}
                    onChange={(event) => void update({ alarmSound: event.target.value as Settings["alarmSound"] })}
                  >
                    {ALARM_SOUNDS.map((sound) => (
                      <option key={sound} value={sound}>
                        {soundNames[sound]}
                      </option>
                    ))}
                  </select>
                </span>
                <button
                  className="button button--compact"
                  type="button"
                  disabled={!settings.alarmEnabled}
                  onClick={() => playAlarm(settings.alarmSound)}
                >
                  <SoundIcon />
                  {en.preview}
                </button>
              </div>
            </div>
            <label className="setting-row">
              <span>
                <strong>{en.notifications}</strong>
              </span>
              <input
                className="switch"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(event) => void update({ notificationsEnabled: event.target.checked })}
              />
            </label>
          </section>

          <section className="settings-section" aria-labelledby="appearance-title">
            <h3 className="settings-section-title" id="appearance-title">
              {en.appearanceSection}
            </h3>
            <label className="setting-row">
              <span>
                <strong>{en.alwaysOnTop}</strong>
              </span>
              <input
                className="switch"
                type="checkbox"
                checked={settings.floatingTimerAlwaysOnTop}
                onChange={(event) => void update({ floatingTimerAlwaysOnTop: event.target.checked })}
              />
            </label>
            <div className="setting-row">
              <div>
                <strong>{en.theme}</strong>
              </div>
              <div className="segmented-control" role="radiogroup" aria-label={en.theme}>
                {(["system", "light", "dark"] as const).map((theme) => (
                  <label key={theme}>
                    <input
                      type="radio"
                      name="theme"
                      value={theme}
                      checked={settings.theme === theme}
                      onChange={() => void update({ theme })}
                    />
                    <span>{theme === "system" ? en.system : theme === "light" ? en.light : en.dark}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="data-title">
            <h3 className="settings-section-title" id="data-title">
              {en.data}
            </h3>
            <div className="backup-layout">
              <div className="backup-column backup-folder">
                <div className="folder-copy">
                  <FolderIcon />
                  <span>
                    <strong>{en.backupFolder}</strong>
                    <small title={settings.backupDirectory ?? undefined}>
                      {settings.backupDirectory ?? en.noFolder}
                    </small>
                  </span>
                </div>
                <div className="inline-control">
                  {settings.backupDirectory && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void update({ backupDirectory: null })}
                    >
                      {en.removeFolder}
                    </button>
                  )}
                  <button className="button button--compact" type="button" onClick={() => void chooseDirectory()}>
                    {en.chooseFolder}
                  </button>
                </div>
              </div>
              <div className="backup-column backup-manual">
                <strong className="backup-column-title">{en.manualBackup}</strong>
                <div className="backup-actions">
                  <button className="button button--secondary" type="button" onClick={() => void onExport()}>
                    <DownloadIcon />
                    {en.exportData}
                  </button>
                  <button className="button button--secondary" type="button" onClick={() => void onImport()}>
                    <UploadIcon />
                    {en.importData}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
