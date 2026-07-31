# MicroTime backup format

A backup is a human-readable UTF-8 JSON file. Its root has the following shape:

```json
{
  "format": "microtime-backup",
  "version": 1,
  "exportedAt": "2026-07-30T12:00:00.000Z",
  "settings": {
    "focusDurationMinutes": 15,
    "breakDurationMinutes": 5,
    "alarmEnabled": true,
    "alarmSound": "gentle",
    "notificationsEnabled": true,
    "floatingTimerAlwaysOnTop": true,
    "floatingTimerVisibleOnAllSpaces": false,
    "theme": "system",
    "backupDirectory": null
  },
  "sessions": []
}
```

Each session contains `id`, `type`, `status`, `startedAt`, `plannedEndAt`,
`completedAt`, `plannedDurationSeconds`, `createdAt`, and `updatedAt`. Timestamps
use ISO 8601 in UTC.

Before importing, MicroTime validates the version, settings, timestamps,
statuses, types, duplicate identifiers, and the presence of no more than one
active session. The content is loaded into SQLite staging tables and replaces
the live dataset in a single transaction. Any error leaves the valid database
unchanged.
