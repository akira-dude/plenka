# Plenka (Плёнка) — agent guide

Personal offline-first photo diary for Android. Expo + React Native + TypeScript. One user, one phone, no sharing, no video, no encryption. Every post is a plain folder (`post.json` + images); Google Drive is a one-way backup target (stage 3, not built yet).

Details are read on demand: `docs/agent/INDEX.md`.

## Language

- Chat with the user: Russian. This file and `docs/agent/**`: English. UI strings: Russian, inline in components (no i18n).
- Commits: English, Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). No AI attribution in commits or PRs.

## Where things are

| Path | What |
| --- | --- |
| `src/app/` | Expo Router routes only. `(tabs)/` = bottom tabs, `compose.tsx` = new/edit post, `post/[id].tsx` = post view |
| `src/domain/` | Pure logic, no React / Expo UI: `post.ts` (format types, parsing), `dates.ts` (ru formatting, local ISO, calendar), `ulid.ts` |
| `src/storage/` | Disk + SQLite. `posts.ts` is the repository (the only writer of posts), `photos.ts` converts images, `paths.ts` folder layout, `db.ts` migrations, `settings.ts` key/value |
| `src/ui/` | Shared components and `theme.ts` (all colors live there) |
| `src/hooks/` | `useDbQuery` — reload a query on screen focus |
| `plugins/` | Local Expo config plugins (`withFragileUserData` → keep-data prompt on uninstall) |
| `docs/agent/` | Architecture, data format contract, roadmap |

## Hard rules

1. **Files are the source of truth, SQLite is a rebuildable index.** Any post change goes through `src/storage/posts.ts` (`savePost`, `deletePost`), which writes `post.json` atomically, then the index row, then the outbox row. Never write post data only to SQLite.
2. **The on-disk format is a contract** (`docs/agent/data-format.md`): it must stay readable by a fresh install (import) and by the PC viewer. Changing a field → bump `POST_FORMAT` in `src/domain/post.ts`, update the doc, keep `parsePost` able to read old posts.
3. **Photos never depend on the system gallery.** Picked or captured images are always copied/converted into the post folder. Never store a gallery URI in a post.
4. **Never crop or change the aspect ratio of a stored photo.** Display-only framing lives in `src/ui/PhotoFrame.tsx`.
5. Routes in `src/app/` stay thin; non-route code goes to `src/domain`, `src/storage`, `src/ui`, `src/hooks`. Import via `@/…`.
6. No comments in code except a rare one-line note on a non-obvious platform quirk.
7. Android only. Do not add iOS/web-specific code paths.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before touching an Expo / React Native API:

1. Check the `expo` major in `package.json`.
2. Prefer the installed type declarations in `node_modules/<pkg>/build/*.d.ts`, or the versioned docs `https://docs.expo.dev/versions/v<major>.0.0/` and `https://docs.expo.dev/llms.txt`.
3. `expo-file-system` is the object API (`File`, `Directory`, `Paths`), not the legacy `documentDirectory` functions.

## Commands

```bash
npx expo install <package>   # always instead of npm install <package>
npm run typecheck            # tsc --noEmit
npm run lint                 # expo lint
npm run doctor               # expo-doctor
npx expo export --platform android --output-dir <tmp>   # bundle check without a device
npm run android              # dev build on a connected phone (needs Android SDK + JDK)
```

Run typecheck and lint before calling a task done. `android/` is generated (CNG) and git-ignored: configure native things in `app.json` or `plugins/`, never by hand. Native modules need a dev build, not Expo Go.

## Keep docs current

When a change moves files, adds a module, changes the post format or finishes a roadmap item, update `AGENTS.md` / `docs/agent/*` in the same change. One fact — one place; link instead of copying.
