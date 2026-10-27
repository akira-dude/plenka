# Roadmap and decisions

Only work that is not built yet, plus the decisions that shape it. Built features are described in `architecture.md` / `data-format.md`, not here.

## Rules for this file

- Finishing an item → delete it here in the same commit and describe the result in `architecture.md` (and `data-format.md` if the format changed).
- The user adds, changes or drops a plan → update this file in the same turn, with the date.
- Every item is tagged **OTA** (ships with `eas update`) or **APK** (needs a new native build, see `AGENTS.md` → «Shipping to the phone»). APK items wait and go out together in one build.

## Decisions

- Android only. Photos only, no video. No encryption. Posts are written from one phone; the cloud is a backup that can be merged back (2026-10-27).
- Cloud: Google Drive, scope `drive.file`, visible folder `My Drive/Плёнка`. Later the user plans a small always-on home server behind the router; sync goes through a provider interface so it can become a second backend. GitHub was rejected for photos (repo size limits, binary history).
- Sharing: one photo at a time through the system share sheet, JPEG, no text, no links.
- Photo quality: `original` (byte copy) → `visual` (WebP 0.9, full size) → `compact` (WebP 0.85, ≤ 1600 px). Default from settings, per-post override; an edit can only lower the quality of stored photos.
- Photos taken in the app stay only in the app; gallery photos are copied.
- Dropped on 2026-10-27: custom in-app camera, «also save to gallery», zip export/import, PC viewer. Drive is the only way to move data.

## Planned

### OTA

- **Merge with the cloud.** «Восстановить» must merge, not just fill an empty app: local posts and cloud posts end up as the union on both sides (e.g. 2025 on the phone + 2026 in Drive). Same post id → higher `rev` wins; local-only posts get queued for upload.
- **Restore offer on an empty diary.** Empty feed shows «Восстановить из Google Drive» (connects first if needed).
- **Lazy originals.** Restore pulls `post.json` + thumbnails only; an original is downloaded when it is opened, shared or re-encoded.
- **Free up space.** Settings action that deletes local originals already safe in the cloud (thumbnails stay; originals come back on demand).
- **On this day.** Feed block with posts from the same day in earlier years.
- **Provider interface.** Sync engine talks to a `CloudStore` interface; Google Drive is one implementation. Prepares the home-server backend.

### APK

- **Background sync** while the app is closed (`expo-background-task`).
- **Expo SDK patch bump** — see «Open technical debt».

### Later

- **Home server backend** (the user's own always-on box). Protocol not chosen yet (WebDAV or a small own API over HTTP); plain HTTP would be OTA, anything needing a native client would be APK.

## Open technical debt

Temporary notes. When an item is resolved, delete its entry here and every pointer to it (`AGENTS.md` → «Shipping to the phone») in the same commit.

- **Expo SDK patch mismatch (noted 2026-10-27).** The EAS build of 0.6.0 (versionCode 6) reported `expo-doctor` 19/20: `expo` 58.0.19 → ~58.0.20, `expo-file-system` 58.0.11 → ~58.0.12, `expo-router` 58.0.26 → ~58.0.27. The patches came out while the build was queued; the build itself is fine. Deliberately not fixed yet: `expo` and `expo-file-system` carry native code, so bumping them changes the runtime fingerprint and forces a new APK. Fix it in the next build that needs a new APK anyway: `npx expo install --fix`, then `npx expo-doctor` must show 20/20, then typecheck, lint, bundle export, `eas build`. After that, remove this entry and the pointer in `AGENTS.md`.
