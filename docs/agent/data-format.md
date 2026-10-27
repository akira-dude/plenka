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

On the phone a `media/*` original may be missing (after a merge from the cloud or «Освободить место»); the cloud copy is complete. Thumbnails and `post.json` are always present. Readers fall back to the thumbnail.

- The folder name is derived from `createdAt` and `id` (`postDirName`). Changing the date of a post moves its folder.
- Media numbers only grow inside a post; a removed `02` is not reused.

## `post.json`

| Field | Type | Notes |
| --- | --- | --- |
| `format` | `"plenka/1"` | Posts with another value are skipped by `parsePost` |
| `id` | string | ULID, generated offline, time-sortable |
| `createdAt` | string | Local ISO with offset, `2026-10-27T14:32:08+03:00`. The post's diary date, user-editable |
| `updatedAt` | string | Same format, last change |
| `rev` | number | +1 on every save or delete |
| `text` | string | Trimmed, may be empty |
| `tags` | string[] | Lowercase, no `#`, unique |
| `place` | `{ name, lat?, lon? }` or `null` | `name` may be empty when only coordinates are known; `lat/lon` from photo EXIF or device GPS, 5 decimals |
| `media` | MediaItem[] | Order = display order, first is the cover |
| `deleted` | boolean | Tombstone: `true` + empty `media` |

MediaItem: `{ file, thumb, type: "image", w, h, bytes, sha256, quality? }` — paths are relative to the post folder; `w`/`h` are display dimensions after EXIF orientation; `sha256` is hex of the stored file; `quality` is `original` / `visual` / `compact` (optional, added 2026-10-27; when missing, readers infer it: not `.webp` → `original`, long side ≤ 1600 → `compact`, else `visual`).

The human-facing number `№ N` is not part of the format: it is the post's rank by `createdAt`. Early test posts may still contain a `frame` field; it is ignored.

## Compatibility rules

- Additive optional fields are fine within `plenka/1`; `parsePost` must default them.
- Renaming/removing a field or changing a meaning → new format version, keep reading the old one.
- The SQLite index is never part of the format; `rebuildIndex` must be able to recreate it from folders alone.
