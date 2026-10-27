# Roadmap and decisions

## Decisions made with the user (2026-10-27)

- Android only. Photos only, no video. No encryption. No sharing of any kind. Posts are written from one phone only, so sync is one-way (phone → cloud) with no conflict handling.
- Cloud: Google Drive, scope `drive.file`, visible folder `My Drive/Плёнка`. Storage is meant to sit behind a `StorageProvider` interface so another backend (Yandex Disk, WebDAV, Syncthing) can be added later. GitHub was rejected for photo storage (repo size limits, binary history).
- Photo quality: default "visually lossless" WebP 0.9 at full resolution; optional byte-for-byte original.
- Photos taken in the app stay only in the app; picked gallery photos are copied, so deleting them from the gallery does not affect the diary.

## Stages

1. **Offline diary** — in progress; the first APK was tested by the user on 2026-10-27.
   - Done: data layer (folders, atomic `post.json`, SQLite index, outbox, rebuild), feed (list/grid), archive calendar with per-day add button, compose (camera, gallery, date/time picker, place, tags, edit), post view, delete, settings (quality, usage, rebuild index), keep-data-on-uninstall prompt.
   - Done after the first device test: 5-item tab bar without ripple, system/light/dark theme, month sections in the feed, cover crop in the feed, numbers by date order, calendar weeks fixed, GPS + reverse geocoding, map of posts, full-screen zoom viewer, search, edit/delete icons in the post header.
   - Next: custom in-app camera for several shots in a row (`expo-camera`), optional "also save to gallery" toggle (`expo-media-library`), app icon and splash.
   - Not verified on a device yet: everything from the second batch above.
2. **Transfer** — zip export/import of the root folder, PC viewer `index.html` + `feed.js`.
3. **Google Drive** — the user expects it next. Needs from the user: a Google Cloud project with the Drive API enabled, OAuth consent screen in production, an Android OAuth client for `dev.akiradude.plenka` with the SHA-1 of the EAS keystore. Then: Google sign-in, drain `outbox` (media first, `post.json` last, skip by `sha256`), restore into an empty app, background task, "photos only over Wi-Fi".
4. **Comfort** — search, tags list, "on this day", free up space by evicting old originals (thumbnails stay).
