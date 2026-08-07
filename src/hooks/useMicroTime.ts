import { useCallback, useEffect, useRef, useState } from "react";
import { en } from "../i18n/en";
import { groupFocusCompletionsByLocalDay, localDateKey } from "../domain/activity";
import { restoreActiveSession, startSession } from "../domain/sessionCoordinator";
import { calculateProgress } from "../domain/timer";
import {
  broadcastDataChanged,
  configureFloatingTimer,
  exportBackupFile,
  getTimerSnapshot,
  listenForDataChanges,
  listenForInterruptRequest,
  playAlarm,
  selectBackupFile,
  sendProgressNotification,
  sendSessionNotification,
  setFloatingTimerVisible,
  showMainWindow,
  writeAutomaticBackup,
} from "../services/platform";
import { createRepository, type Repository } from "../services/repository";
import { DEFAULT_SETTINGS, type Session, type SessionType, type Settings } from "../types";

type Notice = { kind: "success" | "error"; message: string } | null;

const PROGRESS_NOTIFICATION_INTERVAL_SECONDS = 180;

export function useMicroTime() {
  const repositoryRef = useRef<Repository | null>(null);
  const completionLockRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [finishedType, setFinishedType] = useState<SessionType | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [todayKey, setTodayKey] = useState(() => localDateKey());

  const syncToday = useCallback(() => {
    setTodayKey((previous) => {
      const current = localDateKey();
      return previous === current ? previous : current;
    });
  }, []);

  const refresh = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const [nextSettings, nextSessions] = await Promise.all([repository.getSettings(), repository.listSessions()]);
    const nextActive = nextSessions.find((session) => session.status === "active") ?? null;
    setSettings(nextSettings);
    setSessions(nextSessions);
    setActiveSession(nextActive);
    if (nextActive) {
      const snapshot = await getTimerSnapshot(nextActive.plannedDurationSeconds, nextActive.plannedEndAt);
      setRemainingSeconds(snapshot.remainingSeconds);
    } else {
      setRemainingSeconds(0);
    }
  }, []);

  const createAutomaticBackup = useCallback(async (currentSettings: Settings) => {
    const repository = repositoryRef.current;
    if (!repository || !currentSettings.backupDirectory) return;
    const today = localDateKey();
    if ((await repository.getMetadata("last_automatic_backup")) === today) return;
    const payload = await repository.exportData();
    await writeAutomaticBackup(currentSettings.backupDirectory, payload);
    await repository.setMetadata("last_automatic_backup", today);
  }, []);

  const handleExternalInterrupt = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const session = await repository.getActiveSession();
    if (!session) return;
    const snapshot = await getTimerSnapshot(session.plannedDurationSeconds, session.plannedEndAt);
    if (await repository.interruptSession(session.id, snapshot.nowUtc)) {
      setActiveSession(null);
      setFinishedType(null);
      setRemainingSeconds(0);
      await setFloatingTimerVisible(false);
      await broadcastDataChanged();
      await refresh();
    }
  }, [refresh]);

  const finish = useCallback(
    async (session: Session, completedAt?: string) => {
      if (completionLockRef.current) return;
      completionLockRef.current = true;
      try {
        const repository = repositoryRef.current;
        if (!repository) return;
        const changed = await repository.completeSession(session.id, completedAt ?? new Date().toISOString());
        if (!changed) {
          await refresh();
          return;
        }
        syncToday();
        setFinishedType(session.type);
        if (settings.alarmEnabled) playAlarm(settings.alarmSound);
        if (settings.notificationsEnabled) {
          await sendSessionNotification(session.type);
        }
        await broadcastDataChanged();
        await refresh();
        await setFloatingTimerVisible(false);
        await showMainWindow();
        await createAutomaticBackup(settings);
      } finally {
        completionLockRef.current = false;
      }
    },
    [createAutomaticBackup, refresh, settings, syncToday],
  );

  useEffect(() => {
    let disposed = false;
    let unlistenData: (() => void) | undefined;
    let unlistenInterrupt: (() => void) | undefined;

    void (async () => {
      try {
        const repository = await createRepository();
        repositoryRef.current = repository;
        const restored = await restoreActiveSession(repository);
        if (disposed) return;
        const restoredSettings = await repository.getSettings();
        setSettings(restoredSettings);
        if (restored.completedDuringRestore) {
          setFinishedType(restored.completedDuringRestore.type);
          if (restoredSettings.alarmEnabled) playAlarm(restoredSettings.alarmSound);
          if (restoredSettings.notificationsEnabled) {
            await sendSessionNotification(restored.completedDuringRestore.type);
          }
        }
        await configureFloatingTimer(
          restoredSettings.floatingTimerAlwaysOnTop,
          restoredSettings.floatingTimerVisibleOnAllSpaces,
        );
        await refresh();
        if (restored.session) {
          await setFloatingTimerVisible(true);
        }
        await createAutomaticBackup(restoredSettings);
        unlistenData = await listenForDataChanges(() => void refresh());
        unlistenInterrupt = await listenForInterruptRequest(() => void handleExternalInterrupt());
      } catch (error) {
        console.error(error);
        setNotice({ kind: "error", message: en.databaseError });
      } finally {
        if (!disposed) setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      unlistenData?.();
      unlistenInterrupt?.();
    };
  }, [createAutomaticBackup, handleExternalInterrupt, refresh]);

  useEffect(() => {
    if (!activeSession) return;
    let disposed = false;
    let running = false;
    let notifiedIntervals = 0;
    const tick = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const snapshot = await getTimerSnapshot(activeSession.plannedDurationSeconds, activeSession.plannedEndAt);
        if (disposed) return;
        setRemainingSeconds(snapshot.remainingSeconds);
        if (snapshot.remainingSeconds === 0) {
          await finish(activeSession, snapshot.nowUtc);
          return;
        }
        const elapsedSeconds = activeSession.plannedDurationSeconds - snapshot.remainingSeconds;
        const dueIntervals = Math.floor(elapsedSeconds / PROGRESS_NOTIFICATION_INTERVAL_SECONDS);
        if (dueIntervals > notifiedIntervals) {
          notifiedIntervals = dueIntervals;
          if (settings.notificationsEnabled) {
            await sendProgressNotification(activeSession.type, snapshot.remainingSeconds);
          }
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 500);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [activeSession, finish, settings.notificationsEnabled]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const interval = window.setInterval(syncToday, 60_000);
    return () => window.clearInterval(interval);
  }, [syncToday]);

  async function start(type: SessionType) {
    const repository = repositoryRef.current;
    if (!repository || activeSession) return;
    const minutes = type === "focus" ? settings.focusDurationMinutes : settings.breakDurationMinutes;
    const durationSeconds = minutes * 60;
    try {
      const snapshot = await getTimerSnapshot(durationSeconds);
      const session = await startSession(repository, type, durationSeconds, snapshot);
      setFinishedType(null);
      setActiveSession(session);
      setRemainingSeconds(durationSeconds);
      await configureFloatingTimer(settings.floatingTimerAlwaysOnTop, settings.floatingTimerVisibleOnAllSpaces);
      await setFloatingTimerVisible(true);
      await broadcastDataChanged();
      await createAutomaticBackup(settings);
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", message: en.startError });
    }
  }

  async function interrupt() {
    const repository = repositoryRef.current;
    if (!repository || !activeSession) return;
    try {
      const snapshot = await getTimerSnapshot(activeSession.plannedDurationSeconds, activeSession.plannedEndAt);
      if (await repository.interruptSession(activeSession.id, snapshot.nowUtc)) {
        setFinishedType(null);
        setActiveSession(null);
        setRemainingSeconds(0);
        await setFloatingTimerVisible(false);
        await broadcastDataChanged();
        await refresh();
        await createAutomaticBackup(settings);
      }
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", message: en.interruptError });
    }
  }

  async function updateSettings(next: Settings) {
    const repository = repositoryRef.current;
    setSettings(next);
    if (!repository) return;
    try {
      await repository.saveSettings(next);
      await configureFloatingTimer(next.floatingTimerAlwaysOnTop, next.floatingTimerVisibleOnAllSpaces);
      await broadcastDataChanged();
      await createAutomaticBackup(next);
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", message: en.settingsError });
    }
  }

  async function exportData() {
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      if (await exportBackupFile(await repository.exportData())) {
        setNotice({ kind: "success", message: en.exportSuccess });
      }
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", message: en.exportError });
    }
  }

  async function importData() {
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      const backup = await selectBackupFile();
      if (!backup) return;
      await repository.importData(backup);
      setFinishedType(null);
      await refresh();
      await broadcastDataChanged();
      setNotice({ kind: "success", message: en.importSuccess });
    } catch (error) {
      console.error(error);
      setNotice({ kind: "error", message: en.importError });
    }
  }

  const activity = groupFocusCompletionsByLocalDay(sessions);
  const completedToday = activity.find((day) => day.date === todayKey)?.count ?? 0;
  const progress = activeSession ? calculateProgress(activeSession, Date.now()) : 0;

  return {
    loading,
    settings,
    activity,
    activeSession,
    finishedType,
    remainingSeconds,
    progress,
    completedToday,
    notice,
    start,
    interrupt,
    updateSettings,
    exportData,
    importData,
    setNotice,
  };
}
