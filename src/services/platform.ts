import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { serializeBackup, validateBackup } from "../domain/backup";
import { localTimerSnapshot } from "../domain/timer";
import { en } from "../i18n/en";
import type { BackupPayload, SessionType, Settings, TimerSnapshot } from "../types";

export async function getTimerSnapshot(durationSeconds: number, plannedEndAt?: string): Promise<TimerSnapshot> {
  if (!isTauri()) {
    return localTimerSnapshot(durationSeconds, plannedEndAt);
  }
  return invoke<TimerSnapshot>("timer_snapshot", {
    durationSeconds,
    plannedEndAt: plannedEndAt ?? null,
  });
}

export async function configureFloatingTimer(alwaysOnTop: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("configure_floating_timer", { alwaysOnTop });
}

export async function setFloatingTimerVisible(visible: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_floating_timer_visible", { visible });
}

export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_main_window");
}

export async function startWindowDragging(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().startDragging();
}

export async function broadcastDataChanged(): Promise<void> {
  if (isTauri()) {
    await emit("microtime:data-changed");
    return;
  }
  window.dispatchEvent(new CustomEvent("microtime:data-changed"));
}

export async function listenForDataChanges(callback: () => void): Promise<() => void> {
  if (isTauri()) {
    return listen("microtime:data-changed", callback);
  }
  window.addEventListener("microtime:data-changed", callback);
  return () => window.removeEventListener("microtime:data-changed", callback);
}

export async function listenForInterruptRequest(callback: () => void): Promise<() => void> {
  if (isTauri()) {
    return listen("microtime:interrupt-requested", callback);
  }
  return () => undefined;
}

export function playAlarm(sound: Settings["alarmSound"]): void {
  const audio = new Audio(`/sounds/${sound}.wav`);
  audio.volume = 0.72;
  void audio.play().catch(() => undefined);
}

export async function sendSessionNotification(type: SessionType): Promise<boolean> {
  const title = type === "focus" ? en.notificationFocusTitle : en.notificationBreakTitle;
  const body = type === "focus" ? en.notificationFocusBody : en.notificationBreakBody;

  if (isTauri()) {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
    return granted;
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
    return true;
  }
  return false;
}

function downloadTextFile(name: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportBackupFile(payload: BackupPayload): Promise<boolean> {
  const content = serializeBackup(payload);
  const date = payload.exportedAt.slice(0, 10);
  const filename = `MicroTime-backup-${date}.json`;
  if (!isTauri()) {
    downloadTextFile(filename, content);
    return true;
  }
  const path = await save({
    title: "Export MicroTime backup",
    defaultPath: filename,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}

export async function selectBackupFile(): Promise<BackupPayload | null> {
  if (!isTauri()) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        void file
          .text()
          .then((content) => resolve(validateBackup(JSON.parse(content) as unknown)))
          .catch(reject);
      });
      input.click();
    });
  }
  const path = await open({
    title: "Import MicroTime backup",
    multiple: false,
    directory: false,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });
  if (!path) return null;
  return validateBackup(JSON.parse(await readTextFile(path)) as unknown);
}

export async function chooseBackupDirectory(): Promise<string | null> {
  if (!isTauri()) return null;
  return open({
    title: "Automatic backup folder",
    multiple: false,
    directory: true,
  });
}

export async function writeAutomaticBackup(directory: string, payload: BackupPayload): Promise<void> {
  if (!isTauri()) return;
  const path = await join(directory, `MicroTime-auto-${payload.exportedAt.slice(0, 10)}.json`);
  await writeTextFile(path, serializeBackup(payload));
}
