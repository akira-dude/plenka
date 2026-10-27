# Roadmap and decisions

## Decisions made with the user (2026-10-27)

- Android only. Photos only, no video. No encryption. Sharing (decided 2026-10-27): only one photo at a time through the system share sheet, converted to JPEG, no text, no links, no Drive links. Posts are written from one phone only, so sync is one-way (phone → cloud) with no conflict handling.
- Cloud: Google Drive, scope `drive.file`, visible folder `My Drive/Плёнка`. Storage is meant to sit behind a `StorageProvider` interface so another backend (Yandex Disk, WebDAV, Syncthing) can be added later. GitHub was rejected for photo storage (repo size limits, binary history).
- Photo quality: default "visually lossless" WebP 0.9 at full resolution; "compact" WebP 0.85 up to 1600 px on the long side to save Drive space (added 2026-10-27 after real files came out ~2.3 MB); optional byte-for-byte original.
- Photos taken in the app stay only in the app; picked gallery photos are copied, so deleting them from the gallery does not affect the diary.

## Stages

1. **Offline diary** — in progress; the first APK was tested by the user on 2026-10-27.
   - Done: data layer (folders, atomic `post.json`, SQLite index, outbox, rebuild), feed (list/grid), archive calendar with per-day add button, compose (camera, gallery, date/time picker, place, tags, edit), post view, delete, settings (quality, usage, rebuild index), keep-data-on-uninstall prompt.
   - Done after the first device test: 5-item tab bar without ripple, system/light/dark theme, month sections in the feed, cover crop in the feed, numbers by date order, calendar weeks fixed, GPS + reverse geocoding, map of posts, full-screen zoom viewer, search, edit/delete icons in the post header.
   - Next: custom in-app camera for several shots in a row (`expo-camera`), optional "also save to gallery" toggle (`expo-media-library`), app icon and splash.
   - Not verified on a device yet: everything from the second batch above.
2. **Transfer** — zip export/import of the root folder, PC viewer `index.html` + `feed.js`.
3. **Google Drive** — code done 2026-10-27, not tested on a device yet. Google Cloud project `Plenka` is set up by the user (consent screen published, Android + Web clients). Done: sign-in, outbox upload, deletes and moves, restore, Wi-Fi-only toggle, status in feed/post/settings. Next: background sync task, restore offer on the first-run screen, lazy download of originals.
4. **Comfort** — search, tags list, "on this day", free up space by evicting old originals (thumbnails stay).

## Open technical debt

Temporary notes. When an item is resolved, delete its entry here and every pointer to it (`AGENTS.md` → «Shipping to the phone») in the same commit.

- **Expo SDK patch mismatch (noted 2026-10-27).** The EAS build of 0.6.0 (versionCode 6) reported `expo-doctor` 19/20: `expo` 58.0.19 → ~58.0.20, `expo-file-system` 58.0.11 → ~58.0.12, `expo-router` 58.0.26 → ~58.0.27. The patches came out while the build was queued; the build itself is fine. Deliberately not fixed yet: `expo` and `expo-file-system` carry native code, so bumping them changes the runtime fingerprint and forces a new APK. Fix it in the next build that needs a new APK anyway: `npx expo install --fix`, then `npx expo-doctor` must show 20/20, then typecheck, lint, bundle export, `eas build`. After that, remove this entry and the pointer in `AGENTS.md`.
