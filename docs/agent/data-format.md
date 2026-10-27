# Data format `plenka/1`

The diary is a folder. The same layout is used on the phone, in the cloud backup and in a zip export, so a fresh install can import it and a PC can read it without the app. Code: `src/domain/post.ts` (types, `parsePost`), `src/storage/paths.ts` (layout).

## Layout

```
plenka/
├─ manifest.json                 { format, app, createdAt }
└─ posts/
   └─ YYYY/MM/
      └─ DD-HHmm_<last 8 chars of id>/
         ├─ post.json
         ├─ media/01.webp        main image (or 01.jpg/.png/.heic in "original" mode)
         └─ thumbs/01.webp       640 px thumbnail
```

- The folder name is derived from `createdAt` and `id` (`postDirName`). Changing the date of a post moves its folder.
- Media numbers only grow inside a post; a removed `02` is not reused.
- Planned for stage 2–3, not written yet: `index.html` + `feed.js` (PC viewer) in the root.

## `post.json`

| Field | Type | Notes |
| --- | --- | --- |
| `format` | `"plenka/1"` | Posts with another value are skipped by `parsePost` |
| `id` | string | ULID, generated offline, time-sortable |
| `frame` | number | Human-facing sequence number (`№ 412`), max + 1 at creation |
| `createdAt` | string | Local ISO with offset, `2026-10-27T14:32:08+03:00`. The post's diary date, user-editable |
| `updatedAt` | string | Same format, last change |
| `rev` | number | +1 on every save or delete |
| `text` | string | Trimmed, may be empty |
| `tags` | string[] | Lowercase, no `#`, unique |
| `place` | `{ name, lat?, lon? }` or `null` | `lat/lon` come from photo EXIF when present |
| `media` | MediaItem[] | Order = display order, first is the cover |
| `deleted` | boolean | Tombstone: `true` + empty `media` |

MediaItem: `{ file, thumb, type: "image", w, h, bytes, sha256 }` — paths are relative to the post folder; `w`/`h` are display dimensions after EXIF orientation; `sha256` is hex of the stored file.

## Compatibility rules

- Additive optional fields are fine within `plenka/1`; `parsePost` must default them.
- Renaming/removing a field or changing a meaning → new format version, keep reading the old one.
- The SQLite index is never part of the format; `rebuildIndex` must be able to recreate it from folders alone.
