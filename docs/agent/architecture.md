# Architecture

## Layers

```
src/app (routes, screens)
   │  uses
   ├── src/ui        PhotoFrame, PostCard, theme
   ├── src/hooks     useDbQuery
   └── src/storage   posts (repository) ── photos ── paths ── files ── db ── settings
                         │
                     src/domain   post format, dates, ulid  (pure, no Expo UI)
```

- `domain` imports nothing from `storage`, `ui` or `app`. `storage` may import `domain`. `ui` may import `domain` and read-only helpers from `storage` (`mediaUri`, types). Screens import everything.
- The SQLite handle comes from `SQLiteProvider` in `src/app/_layout.tsx` (`useSQLiteContext()`); storage functions take `db` as the first argument.

## Storage model

- Root: `Paths.document/plenka/` (app-internal, invisible to other apps and the gallery). Layout: `data-format.md`.
- SQLite `plenka.db` (default expo-sqlite location), schema in `src/storage/db.ts`, versioned by `PRAGMA user_version`:
  - `posts` — one row per post; `json` holds the full `post.json`, other columns exist for filtering/sorting (`day`, `created_at`, `deleted`).
  - `outbox` — post ids changed since the last upload (filled now, drained by the future Drive sync).
  - `settings` — key/value (`photoQuality`).
- `initStorage` (run by `SQLiteProvider.onInit`): migrate → ensure root + `manifest.json` → if the index is empty, `rebuildIndex` from files (this is also the import path for a copied folder).

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

- `PhotoFrame`: feed frame ratio is clamped to 3:4…16:9. A photo outside that range is shown whole (`contain`) over a blurred copy of its thumbnail. Never crop the file.
- Post view: frame ratio comes from the first photo, clamped so it takes at most ~72% of the screen height; other photos of the post fit into the same frame.
- Grid and calendar use square-cropped thumbnails only.

## Screens

| Route | File | Notes |
| --- | --- | --- |
| Feed | `src/app/(tabs)/index.tsx` | Sections by day, list / grid toggle |
| Archive | `src/app/(tabs)/archive.tsx` | Month grid (days with posts dark + mini cover, empty days grey), selected day's posts, "add post for this day" button → `compose?date=YYYY-MM-DD` |
| Camera tab | `src/app/(tabs)/capture.tsx` | Dummy route; the tab press is intercepted in `(tabs)/_layout.tsx` → `compose?source=camera` |
| Settings | `src/app/(tabs)/settings.tsx` | Photo quality, storage usage, rebuild index |
| Compose | `src/app/compose.tsx` | Params: `id` (edit), `date` (prefill day), `source` (`camera` / `library` to open the picker immediately) |
| Post | `src/app/post/[id].tsx` | Pager, text, tags, edit, delete |

Screens reload their data on focus via `useDbQuery`; there is no global store.
