import { isTauri } from "@tauri-apps/api/core";
import { validateBackup } from "../domain/backup";
import { DEFAULT_SETTINGS, THEMES, type BackupPayload, type Session, type Settings } from "../types";

export interface Repository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  insertSession(session: Session): Promise<void>;
  getActiveSession(): Promise<Session | null>;
  completeSession(id: string, completedAt: string): Promise<boolean>;
  interruptSession(id: string, interruptedAt: string): Promise<boolean>;
  listSessions(): Promise<Session[]>;
  exportData(exportedAt?: string): Promise<BackupPayload>;
  importData(backup: BackupPayload): Promise<void>;
  getMetadata(key: string): Promise<string | null>;
  setMetadata(key: string, value: string): Promise<void>;
}

export class MemoryRepository implements Repository {
  private settings: Settings;
  private sessions: Session[];
  private readonly metadata = new Map<string, string>();

  constructor(initial?: { settings?: Settings; sessions?: Session[] }) {
    this.settings = structuredClone(initial?.settings ?? DEFAULT_SETTINGS);
    this.sessions = structuredClone(initial?.sessions ?? []);
  }

  async getSettings(): Promise<Settings> {
    return structuredClone(this.settings);
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.settings = structuredClone(settings);
  }

  async insertSession(session: Session): Promise<void> {
    if (this.sessions.some((existing) => existing.status === "active")) {
      throw new Error("An active session already exists");
    }
    this.sessions.push(structuredClone(session));
  }

  async getActiveSession(): Promise<Session | null> {
    return structuredClone(this.sessions.find((session) => session.status === "active") ?? null);
  }

  async completeSession(id: string, completedAt: string): Promise<boolean> {
    const session = this.sessions.find((candidate) => candidate.id === id);
    if (session?.status !== "active") return false;
    session.status = "completed";
    session.completedAt = completedAt;
    session.updatedAt = completedAt;
    return true;
  }

  async interruptSession(id: string, interruptedAt: string): Promise<boolean> {
    const session = this.sessions.find((candidate) => candidate.id === id);
    if (session?.status !== "active") return false;
    session.status = "interrupted";
    session.completedAt = null;
    session.updatedAt = interruptedAt;
    return true;
  }

  async listSessions(): Promise<Session[]> {
    return structuredClone(this.sessions).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
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
    this.settings = structuredClone(validated.settings);
    this.sessions = structuredClone(validated.sessions);
  }

  async getMetadata(key: string): Promise<string | null> {
    return this.metadata.get(key) ?? null;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    this.metadata.set(key, value);
  }
}

function createDemoSessions(now = new Date()): Session[] {
  const sessions: Session[] = [];
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const signal = Math.sin(offset * 1.81) + Math.cos(offset * 0.43);
    const count = signal > 1.1 ? 4 : signal > 0.35 ? 2 : signal > -0.25 ? 1 : 0;
    const adjustedCount = date.getDay() % 6 === 0 ? Math.max(0, count - 1) : count;

    for (let index = 0; index < adjustedCount; index += 1) {
      const completedAt = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        11 + (index % 6),
        20,
      ).toISOString();
      const startedAt = new Date(Date.parse(completedAt) - 15 * 60 * 1000).toISOString();
      sessions.push({
        id: `demo-session-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${index}`,
        type: "focus",
        status: "completed",
        startedAt,
        plannedEndAt: completedAt,
        completedAt,
        plannedDurationSeconds: 900,
        createdAt: startedAt,
        updatedAt: completedAt,
      });
    }
  }
  return sessions;
}

export async function createRepository(): Promise<Repository> {
  if (isTauri()) {
    const { openSqliteRepository } = await import("./sqliteRepository");
    return openSqliteRepository();
  }

  const requestedTheme = new URLSearchParams(window.location.search).get("previewTheme");
  const theme = THEMES.find((candidate) => candidate === requestedTheme) ?? DEFAULT_SETTINGS.theme;
  return new MemoryRepository({
    settings: { ...DEFAULT_SETTINGS, theme },
    sessions: import.meta.env.DEV ? createDemoSessions() : [],
  });
}
