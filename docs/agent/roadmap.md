# Roadmap and decisions

Only work that is not built yet, plus the decisions that shape it. Built features are described in `architecture.md` / `data-format.md`, not here.

## Rules for this file

- Finishing an item → delete it here in the same commit and describe the result in `architecture.md` (and `data-format.md` if the format changed).
- The user adds, changes or drops a plan → update this file in the same turn, with the date.
- Every item is tagged **OTA** (ships with `eas update`) or **APK** (needs a new native build, see `AGENTS.md` → «Shipping to the phone»). APK items wait and go out together in one build.

## Decisions

- Android only. Photos and videos (videos since 2026-11-08: stored as is, no transcoding, no length or size limit). No encryption. Posts are written from one phone; the cloud is a backup that can be merged back (2026-10-27).
- Cloud: since 2026-11-08 the user's own home server over WebDAV (`plenka.arsenbox.ru`), chosen instead of Google Drive, not next to it (one provider at a time). Google Drive (`drive.file`, folder `My Drive/Плёнка`) stays supported as the alternative provider. GitHub was rejected for photos (repo size limits, binary history).
- Sharing: one photo (JPEG) or one video (as is) at a time through the system share sheet, no text, no links.
- Photo quality: `original` (byte copy) → `visual` (WebP 0.9, full size) → `compact` (WebP 0.85, ≤ 1600 px). Default from settings, per-post override; an edit can only lower the quality of stored photos.
- Photos taken in the app stay only in the app; gallery photos are copied.
- Dropped on 2026-10-27: custom in-app camera, «also save to gallery», zip export/import, PC viewer. The cloud (server or Drive) is the only way to move data.

## Planned

### OTA

Nothing planned right now.

### APK

- **Background sync** while the app is closed (`expo-background-task`).
- **Server password into the Android keystore** (`expo-secure-store`): today it sits in the app's own SQLite `settings` table.

### Later

Nothing planned right now.

## Open technical debt

Temporary notes. When an item is resolved, delete its entry here and every pointer to it (`AGENTS.md` → «Shipping to the phone») in the same commit.

Nothing open right now.
