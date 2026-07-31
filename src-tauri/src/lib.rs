use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalRect, PhysicalSize, Runtime,
    WebviewWindow,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::StateFlags;

const DATABASE_URL: &str = "sqlite:microtime.db";

#[cfg(all(target_os = "macos", debug_assertions))]
fn set_macos_dev_icon() {
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let Some(main_thread) = MainThreadMarker::new() else {
        return;
    };
    let bytes = include_bytes!("../icons/icon.png");
    let data = unsafe { NSData::dataWithBytes_length(bytes.as_ptr().cast(), bytes.len()) };
    if let Some(icon) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe {
            NSApplication::sharedApplication(main_thread).setApplicationIconImage(Some(&icon));
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerSnapshot {
    now_utc: String,
    planned_end_at: String,
    remaining_seconds: i64,
}

fn snapshot_at(
    duration_seconds: i64,
    planned_end_at: Option<&str>,
    now: DateTime<Utc>,
) -> Result<TimerSnapshot, String> {
    let end = match planned_end_at {
        Some(value) => DateTime::parse_from_rfc3339(value)
            .map_err(|_| "The deadline is not a valid ISO-8601 timestamp".to_string())?
            .with_timezone(&Utc),
        None => {
            if !(1..=604_800).contains(&duration_seconds) {
                return Err("Duration must be between 1 second and 7 days".to_string());
            }
            now + Duration::seconds(duration_seconds)
        }
    };
    let remaining_millis = (end - now).num_milliseconds();
    let remaining_seconds = if remaining_millis <= 0 {
        0
    } else {
        (remaining_millis + 999) / 1000
    };
    Ok(TimerSnapshot {
        now_utc: now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        planned_end_at: end.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        remaining_seconds,
    })
}

#[tauri::command]
fn timer_snapshot(
    duration_seconds: i64,
    planned_end_at: Option<String>,
) -> Result<TimerSnapshot, String> {
    snapshot_at(duration_seconds, planned_end_at.as_deref(), Utc::now())
}

fn show_and_focus<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    Ok(())
}

fn top_right_position(
    work_area: &PhysicalRect<i32, u32>,
    window_size: PhysicalSize<u32>,
    scale_factor: f64,
) -> PhysicalPosition<i32> {
    let margin = (16.0 * scale_factor).round() as u32;
    PhysicalPosition {
        x: work_area.position.x
            + work_area
                .size
                .width
                .saturating_sub(window_size.width.saturating_add(margin)) as i32,
        y: work_area.position.y + margin as i32,
    }
}

fn position_floating_timer<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("floating-timer") else {
        return Ok(());
    };
    let Some(monitor) = app.primary_monitor()? else {
        return Ok(());
    };
    window.set_position(top_right_position(
        monitor.work_area(),
        window.outer_size()?,
        monitor.scale_factor(),
    ))
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available".to_string())?;
    show_and_focus(&window).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_floating_timer_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("floating-timer")
        .ok_or_else(|| "Mini-timer is not available".to_string())?;
    if visible {
        let _ = position_floating_timer(&app);
        window.show().map_err(|error| error.to_string())
    } else {
        window.hide().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn configure_floating_timer(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("floating-timer")
        .ok_or_else(|| "Mini-timer is not available".to_string())?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|error| error.to_string())
}

fn toggle_floating_timer<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("floating-timer") {
        let visible = window.is_visible().unwrap_or(false);
        let _ = if visible {
            window.hide()
        } else {
            let _ = position_floating_timer(app);
            window.show()
        };
    }
}

fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open app", true, None::<&str>)?;
    let timer = MenuItem::with_id(app, "timer", "Show/hide mini-timer", true, None::<&str>)?;
    let interrupt = MenuItem::with_id(app, "interrupt", "Stop session", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &timer, &interrupt, &quit])?;

    let mut builder = TrayIconBuilder::with_id("microtime-tray")
        .tooltip("MicroTime")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = show_and_focus(&window);
                }
            }
            "timer" => toggle_floating_timer(app),
            "interrupt" => {
                let _ = app.emit("microtime:interrupt-requested", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = show_and_focus(&window);
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn run() {
    let window_state_flags =
        StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN;
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "atomic import staging",
            sql: include_str!("../migrations/0002_import_staging.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            timer_snapshot,
            show_main_window,
            set_floating_timer_visible,
            configure_floating_timer
        ])
        .setup(|app| {
            #[cfg(all(target_os = "macos", debug_assertions))]
            set_macos_dev_icon();
            build_tray(app)?;
            if let Some(window) = app.get_webview_window("main") {
                show_and_focus(&window)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if matches!(window.label(), "main" | "floating-timer") {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while starting MicroTime");
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn remaining_time_is_derived_from_deadline() {
        let now = Utc.with_ymd_and_hms(2026, 7, 30, 10, 0, 0).unwrap();
        let snapshot = snapshot_at(900, Some("2026-07-30T10:02:00Z"), now).unwrap();
        assert_eq!(snapshot.remaining_seconds, 120);
    }

    #[test]
    fn elapsed_deadline_returns_zero() {
        let now = Utc.with_ymd_and_hms(2026, 7, 30, 10, 5, 0).unwrap();
        let snapshot = snapshot_at(900, Some("2026-07-30T10:02:00Z"), now).unwrap();
        assert_eq!(snapshot.remaining_seconds, 0);
    }

    #[test]
    fn floating_timer_defaults_to_top_right_work_area() {
        let work_area = PhysicalRect {
            position: PhysicalPosition { x: 0, y: 50 },
            size: PhysicalSize {
                width: 1920,
                height: 1030,
            },
        };
        let position = top_right_position(
            &work_area,
            PhysicalSize {
                width: 440,
                height: 116,
            },
            2.0,
        );
        assert_eq!(position, PhysicalPosition { x: 1448, y: 82 });
    }
}
