import { useEffect, useState } from "react";
import { Heatmap } from "./components/Heatmap";
import { SettingsIcon, CloseIcon } from "./components/Icons";
import { Logo } from "./components/Logo";
import { SessionPanel } from "./components/SessionPanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { FloatingTimer } from "./components/FloatingTimer";
import { useMicroTime } from "./hooks/useMicroTime";
import { en } from "./i18n/en";

function MainApplication() {
  const controller = useMicroTime();
  const [settingsOpen, setSettingsOpen] = useState(
    () => new URLSearchParams(window.location.search).get("settings") === "1",
  );

  useEffect(() => {
    if (!controller.notice) return;
    const timeout = window.setTimeout(() => controller.setNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [controller.notice, controller.setNotice]);

  if (controller.loading) {
    return (
      <main className="loading-screen">
        <Logo />
        <span className="loading-dot" />
        <p>{en.loading}</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header" data-tauri-drag-region>
        <Logo />
        <button
          className="button button--settings"
          type="button"
          aria-label={en.opensSettings}
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
        </button>
      </header>

      <main className="main-content">
        <div className="daily-controls-row">
          <section className="today-hero" aria-labelledby="today-title">
            <div className="today-copy">
              <p className="eyebrow" id="today-title">
                {en.today}
              </p>
              <div className="today-number-line">
                <strong>{controller.completedToday}</strong>
                <span>{en.completedToday}</span>
              </div>
            </div>
          </section>

          <SessionPanel
            activeSession={controller.activeSession}
            finishedType={controller.finishedType}
            remainingSeconds={controller.remainingSeconds}
            progress={controller.progress}
            focusMinutes={controller.settings.focusDurationMinutes}
            breakMinutes={controller.settings.breakDurationMinutes}
            onStart={(type) => void controller.start(type)}
            onInterrupt={() => void controller.interrupt()}
          />
        </div>

        <Heatmap activity={controller.activity} />
      </main>

      <SettingsDialog
        open={settingsOpen}
        settings={controller.settings}
        onClose={() => setSettingsOpen(false)}
        onUpdate={controller.updateSettings}
        onExport={controller.exportData}
        onImport={controller.importData}
      />

      {controller.notice && (
        <div className={`toast toast--${controller.notice.kind}`} role="status">
          <span>{controller.notice.message}</span>
          <button
            className="toast-close"
            type="button"
            aria-label={en.close}
            onClick={() => controller.setNotice(null)}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function FloatingApplication() {
  const controller = useMicroTime();
  return (
    <FloatingTimer
      session={controller.activeSession}
      remainingSeconds={controller.remainingSeconds}
      progress={controller.progress}
    />
  );
}

export default function App() {
  const windowKind = new URLSearchParams(window.location.search).get("window");
  return windowKind === "floating" ? <FloatingApplication /> : <MainApplication />;
}
