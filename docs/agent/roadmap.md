# Roadmap and decisions

## Decisions made with the user (2026-10-27)

- Android only. Photos only, no video. No encryption. No sharing of any kind. Posts are written from one phone only, so sync is one-way (phone → cloud) with no conflict handling.
- Cloud: Google Drive, scope `drive.file`, visible folder `My Drive/Плёнка`. Storage is meant to sit behind a `StorageProvider` interface so another backend (Yandex Disk, WebDAV, Syncthing) can be added later. GitHub was rejected for photo storage (repo size limits, binary history).
- Photo quality: default "visually lossless" WebP 0.9 at full resolution; optional byte-for-byte original.
- Photos taken in the app stay only in the app; picked gallery photos are copied, so deleting them from the gallery does not affect the diary.

## Stages

1. **Offline diary** — in progress.
   - Done: data layer (folders, atomic `post.json`, SQLite index, outbox, rebuild), feed (list/grid), archive calendar with per-day add button, compose (camera, gallery, date/time picker, place, tags, edit), post view, delete, settings (quality, usage, rebuild index), keep-data-on-uninstall prompt.
   - Next: custom in-app camera for several shots in a row (`expo-camera`), full-screen zoomable viewer, optional "also save to gallery" toggle (`expo-media-library`), app icon and splash.
   - Not verified on a real device yet: build with `npm run android` and test camera, picker, WebP conversion, date change (folder move).
2. **Transfer** — zip export/import of the root folder, PC viewer `index.html` + `feed.js`.
3. **Google Drive** — Google sign-in, drain `outbox` (media first, `post.json` last, skip by `sha256`), restore into an empty app, background task, "photos only over Wi-Fi".
4. **Comfort** — search, tags list, "on this day", free up space by evicting old originals (thumbnails stay).
