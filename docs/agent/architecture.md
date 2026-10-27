# Architecture

## Layers

```
src/app (routes, screens)
   │  uses
   ├── src/ui        PhotoFrame, PostCard, PostRow, ZoomableImage, ThemeProvider, mapHtml
   ├── src/hooks     useDbQuery
   ├── src/device    location (GPS, reverse geocoding)
   ├── src/sync      Google sign-in, Drive client, sync engine
   └── src/storage   posts (repository) ── photos ── paths ── files ── db ── settings
                         │
                     src/domain   post format, dates, ulid  (pure, no Expo UI)
```

- `domain` imports nothing from `storage`, `ui` or `app`. `storage` may import `domain`. `ui` may import `domain` and read-only helpers from `storage` (`mediaUri`, types). Screens import everything.
- The SQLite handle comes from `SQLiteProvider` in `src/app/_layout.tsx` (`useSQLiteContext()`); storage functions take `db` as the first argument.

## Storage model

- Root: `Paths.document/plenka/` (app-internal, invisible to other apps and the gallery). Layout: `data-format.md`.
- SQLite `plenka.db` (default expo-sqlite location), schema in `src/storage/db.ts`, versioned by `PRAGMA user_version`:
  - `posts` — one row per post; `json` holds the full `post.json`, other columns exist for filtering/sorting (`day`, `created_at`, `deleted`) and `search` (lowercased text + tags + place, because SQLite `lower`/`LIKE` ignore Cyrillic case).
  - Post numbers are computed, not stored: `ROW_NUMBER() OVER (ORDER BY created_at, id)` over non-deleted posts, so a post written for an earlier date takes its place in the sequence.
  - `outbox` — post ids changed since the last upload (filled now, drained by the future Drive sync).
  - `settings` — key/value (`photoQuality`, `themeMode`, `wifiOnly`, `lastSyncAt`).
  - `drive_files` — local path (relative to the root, `''` = the root folder) → Drive file id (+ `sha256` for media).
  - `synced_posts` — post id → folder and `rev` last uploaded; used to detect moved folders and to show «в Google Drive».
- `initStorage` (run by `SQLiteProvider.onInit`): migrate → ensure root + `manifest.json` → if the index is empty or has rows without `search`, `rebuildIndex` from files (this is also the import path for a copied folder).

## Write path (`src/storage/posts.ts`)

`savePost(db, draft, quality, id?)`:
1. Resolve the folder from id + `createdAt`. If the date changed on edit, `moveTree` moves the folder file by file.
2. Delete media removed in the editor; convert new photos with `storePhoto` (numbering continues after existing files).
3. `commit`: write `post.json` atomically (`.tmp` → move), then in one transaction upsert the index row and the outbox row.

`deletePost`: deletes media files, writes a tombstone `post.json` (`deleted: true`, `media: []`, `rev + 1`). The folder stays so a future sync can propagate the deletion.

## Photos (`src/storage/photos.ts`)

- Source: `expo-image-picker` (system camera intent or Android Photo Picker). Captured photos land in the app cache, not in the gallery; picked ones are copies. No storage permission is needed on Android 13+.
- Quality modes (`settings.ts` → `PhotoQuality`): `visual` = WebP 0.9 at full resolution after EXIF orientation is applied; `original` = byte-for-byte copy.
- Thumbnail: WebP 0.8, longest side 640 px, used for grid, calendar, blur backgrounds.
- `sha256` of the stored file goes into `post.json` (dedup key for upload later).
- EXIF date/GPS are read in the editor (`parseExifDate`, `parseExifGps`) to prefill the post; they are not copied into the WebP.

## Display rules

- `PhotoFrame`: feed frame ratio is clamped to 3:4…16:9. In the feed (`fit="cover"`) a photo outside that range fills the frame and is cropped along its long side, display only. Never crop the file.
- Post view (`fit="whole"`): frame ratio comes from the first photo, clamped so it takes at most ~72% of the screen height; other photos are shown whole over a blurred copy of their thumbnail. Tap opens the full-screen viewer.
- Viewer (`ZoomableImage`): pinch 1–5x, pan when zoomed, double tap 2.5x / reset, vertical swipe down when not zoomed closes the viewer (horizontal moves fail the pan so the pager scrolls); react-native-gesture-handler v3 hooks with `runOnJS: true`.
- Grid and calendar use square-cropped thumbnails only.

## Screens

| Route | File | Notes |
| --- | --- | --- |
| Feed | `src/app/(tabs)/index.tsx` | Sticky month sections, month select button → `MonthPicker` modal (year arrows + 12-month grid with post counts; Android has no native month-only picker) that filters list and grid, list / grid toggle, sync pill, map button |
| Archive | `src/app/(tabs)/archive.tsx` | Month grid (days with posts dark + mini cover, empty days grey), selected day's posts, "add post for this day" button → `compose?date=YYYY-MM-DD` |
| Camera tab | `src/app/(tabs)/capture.tsx` | Dummy route; the tab press is intercepted in `(tabs)/_layout.tsx` → `compose?source=camera` |
| Search | `src/app/(tabs)/search.tsx` | Text / tag / place search over the `search` column |
| Settings | `src/app/(tabs)/settings.tsx` | Drive status (placeholder), theme, photo quality, storage usage, rebuild index |
| Compose | `src/app/compose.tsx` | Params: `id` (edit), `date` (prefill day), `source` (`camera` / `library` to open the picker immediately) |
| Post | `src/app/post/[id].tsx` | Pager, text, tags, place link → map; header: edit, delete (red) |
| Viewer | `src/app/viewer/[id].tsx` | Full-screen black pager with zoom, param `index` |
| Map | `src/app/map.tsx` | WebView with Leaflet (unpkg) and OpenStreetMap tiles, needs internet. The WebView `baseUrl` is the GitHub Pages site so OSM gets a Referer (without it OSM returns "Access blocked"; CARTO basemaps now need an API key); dark theme inverts the tile layer with a CSS filter; param `focus` = post id; popup button posts the id back |

Screens reload their data on focus via `useDbQuery`; there is no global store.

## Theme

`ThemeProvider` (inside `SQLiteProvider`) reads `themeMode` (`system` / `light` / `dark`) from settings, calls `Appearance.setColorScheme` so native dialogs follow, and exposes the palette. The root layout maps it onto the navigation theme, `StatusBar` and `NavigationBar`, so Android system buttons stay visible in both themes. `app.json` uses `userInterfaceStyle: automatic`.

## Location

`src/device/location.ts`, foreground permission only. A new post (not an edit, not opened from the archive with a date) asks for the current position on open; EXIF GPS of a picked photo wins over the device position; the crosshair button forces a fresh device fix. Reverse geocoding fills the place name only when the field is empty and gives up quietly offline.

## Google Drive sync (`src/sync/`)

- Auth: `@react-native-google-signin/google-signin`, scope `drive.file`, `webClientId` = the Web OAuth client of Google Cloud project `Plenka`. The Android OAuth client there is bound to package `dev.akiradude.plenka` + SHA-1 of the EAS keystore; a different signing key (local debug build) needs its own Android client. `DEVELOPER_ERROR` (code 10) means that pair does not match.
- Drive layout mirrors the local root: `My Drive/Плёнка/manifest.json`, `posts/YYYY/MM/<post>/{post.json,media/*,thumbs/*}`.
- `syncNow(db)`: skip if not signed in, offline, or Wi-Fi-only on mobile data. For each `outbox` row (oldest first): a deleted post → trash its Drive folder; a moved post (date changed) → trash the old folder; upload media (skipped when `sha256` matches), thumbnails (once), trash media that left the post, upload `post.json` last; then delete the outbox row only if `rev` did not change meanwhile.
- Uploads: media via resumable session + `File.upload` (native, binary); `post.json` via multipart / media PATCH. Missing mappings are looked up by name in the parent folder before creating, so a reinstall does not duplicate files.
- A 404 from Drive (folder deleted outside the app) resets `drive_files` / `synced_posts` and re-queues every post.
- Triggers (`useAutoSync`, mounted in the root layout): app start, app back to foreground, network reconnect; plus `syncNow` after save/delete. No background task yet.
- Restore (`restoreFromDrive`): walk the `Плёнка` folder, download files missing locally, `rebuildIndex`, mark everything as synced. Existing local files are never overwritten.
- UI state lives in a module store (`useSyncState`): account, running, done/total, queued, last sync, error.
