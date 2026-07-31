import { describe, expect, it } from "vitest";
import { groupFocusCompletionsByLocalDay } from "./activity";
import { serializeBackup, validateBackup } from "./backup";
import { restoreActiveSession, startSession } from "./sessionCoordinator";
import { calculateRemainingSeconds, localTimerSnapshot } from "./timer";
import { MemoryRepository } from "../services/repository";
import { DEFAULT_SETTINGS, type Session } from "../types";

const NOW = Date.parse("2026-07-30T10:00:00.000Z");
const SNAPSHOT = localTimerSnapshot(900, undefined, NOW);

async function activeFocus(repository = new MemoryRepository()): Promise<Session> {
  return startSession(repository, "focus", 900, SNAPSHOT, "focus-session-0001");
}

async function focusCount(repository: MemoryRepository, localDay: string): Promise<number> {
  const activity = groupFocusCompletionsByLocalDay(await repository.listSessions(), "UTC");
  return activity.find((day) => day.date === localDay)?.count ?? 0;
}

describe("session domain", () => {
  it("records a session immediately with its deadline and duration", async () => {
    const repository = new MemoryRepository();
    const session = await activeFocus(repository);
    expect(session.status).toBe("active");
    expect(session.plannedDurationSeconds).toBe(900);
    expect(session.plannedEndAt).toBe("2026-07-30T10:15:00.000Z");
    expect(await repository.getActiveSession()).toEqual(session);
  });

  it("calculates remaining time from the deadline instead of intervals", () => {
    expect(calculateRemainingSeconds(SNAPSHOT.plannedEndAt, NOW + 1_234)).toBe(899);
    expect(calculateRemainingSeconds(SNAPSHOT.plannedEndAt, NOW + 900_001)).toBe(0);
  });

  it("completes and counts a focus session", async () => {
    const repository = new MemoryRepository();
    const session = await activeFocus(repository);
    expect(await repository.completeSession(session.id, "2026-07-30T10:15:00.000Z")).toBe(true);
    expect(await focusCount(repository, "2026-07-30")).toBe(1);
  });

  it("makes completion idempotent", async () => {
    const repository = new MemoryRepository();
    const session = await activeFocus(repository);
    expect(await repository.completeSession(session.id, "2026-07-30T10:15:00.000Z")).toBe(true);
    expect(await repository.completeSession(session.id, "2026-07-30T10:16:00.000Z")).toBe(false);
    expect(await focusCount(repository, "2026-07-30")).toBe(1);
  });

  it("does not count an interrupted session", async () => {
    const repository = new MemoryRepository();
    const session = await activeFocus(repository);
    expect(await repository.interruptSession(session.id, "2026-07-30T10:02:00.000Z")).toBe(true);
    expect(await focusCount(repository, "2026-07-30")).toBe(0);
  });

  it("does not count a completed break", async () => {
    const repository = new MemoryRepository();
    const session = await startSession(
      repository,
      "break",
      300,
      localTimerSnapshot(300, undefined, NOW),
      "break-session-0001",
    );
    await repository.completeSession(session.id, "2026-07-30T10:05:00.000Z");
    expect(await focusCount(repository, "2026-07-30")).toBe(0);
  });

  it("groups completions by local day", () => {
    const base: Session = {
      id: "late-session-001",
      type: "focus",
      status: "completed",
      startedAt: "2026-07-30T22:40:00.000Z",
      plannedEndAt: "2026-07-30T22:55:00.000Z",
      completedAt: "2026-07-30T22:55:00.000Z",
      plannedDurationSeconds: 900,
      createdAt: "2026-07-30T22:40:00.000Z",
      updatedAt: "2026-07-30T22:55:00.000Z",
    };
    expect(groupFocusCompletionsByLocalDay([base], "Europe/Rome")).toEqual([{ date: "2026-07-31", count: 1 }]);
  });

  it("restores an unexpired session after restart", async () => {
    const repository = new MemoryRepository();
    const session = await activeFocus(repository);
    const restored = await restoreActiveSession(repository, NOW + 60_000);
    expect(restored.session).toEqual(session);
    expect(restored.completedDuringRestore).toBeNull();
  });

  it("completes an expired session only once during restart", async () => {
    const repository = new MemoryRepository();
    await activeFocus(repository);
    const first = await restoreActiveSession(repository, NOW + 901_000);
    const second = await restoreActiveSession(repository, NOW + 902_000);
    expect(first.completedDuringRestore?.id).toBe("focus-session-0001");
    expect(second.completedDuringRestore).toBeNull();
    expect(await focusCount(repository, "2026-07-30")).toBe(1);
  });
});

describe("settings and backups", () => {
  it("reads and saves settings", async () => {
    const repository = new MemoryRepository();
    const changed = { ...DEFAULT_SETTINGS, focusDurationMinutes: 22, theme: "dark" as const };
    await repository.saveSettings(changed);
    expect(await repository.getSettings()).toEqual(changed);
  });

  it("exports, validates, and imports all data", async () => {
    const source = new MemoryRepository();
    const session = await activeFocus(source);
    await source.completeSession(session.id, "2026-07-30T10:15:00.000Z");
    const backup = await source.exportData("2026-07-30T12:00:00.000Z");
    const serialized = serializeBackup(backup);
    const target = new MemoryRepository();
    await target.importData(validateBackup(JSON.parse(serialized) as unknown));
    expect(await target.listSessions()).toEqual(await source.listSessions());
    expect(await target.getSettings()).toEqual(await source.getSettings());
  });
});
