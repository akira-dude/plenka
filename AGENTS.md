# Plenka (Плёнка) — agent guide

Personal offline-first photo diary for Android. Expo + React Native + TypeScript. One user, one phone, no video, no encryption; sharing is limited to sending a single photo through the system share sheet. Every post is a plain folder (`post.json` + images); Google Drive is the backup that can be merged back into the phone (`src/sync/`).

Details are read on demand: `docs/agent/INDEX.md`.

## Language

- Chat with the user: Russian. This file and `docs/agent/**`: English. UI strings: Russian, inline in components (no i18n).
- Commits: English, Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). No AI attribution in commits or PRs.

## Where things are

| Path | What |
| --- | --- |
| `src/app/` | Expo Router routes only. `(tabs)/` = bottom tabs (feed, archive, camera, search, settings), `compose.tsx` = new/edit post, `post/[id].tsx` = post view, `viewer/[id].tsx` = full-screen zoom, `map.tsx` = map of posts |
| `src/domain/` | Pure logic, no React / Expo UI: `post.ts` (format types, parsing), `dates.ts` (ru formatting, local ISO, calendar), `search.ts` (search words, `#tag` queries, tag counts and suggestions, highlight, snippet), `ulid.ts` |
| `src/storage/` | Disk + SQLite. `posts.ts` is the repository (the only writer of posts), `photos.ts` converts images, `paths.ts` folder layout, `db.ts` migrations, `settings.ts` key/value |
| `src/ui/` | Shared components, `theme.ts` (light/dark palettes), `ThemeProvider.tsx` (`useTheme`, `useStyles`), `mapHtml.ts` (Leaflet page for the map WebView) |
| `src/device/` | Device services: `location.ts` (GPS, reverse geocoding), `share.ts` (send one photo as JPEG through the system share sheet) |
| `src/sync/` | Cloud backup: `store.ts` (`CloudStore` interface), `driveStore.ts` (Google Drive implementation, path ↔ id mapping), `drive.ts` (REST v3 client), `auth.ts` (Google sign-in, web client id), `engine.ts` (outbox → cloud, `mergeFromCloud`, `useSyncState`), `media.ts` (lazy originals, free up space), `useAutoSync.ts` (triggers) |
| `src/hooks/` | `useDbQuery` — reload a query on screen focus |
| `plugins/` | Local Expo config plugins (`withFragileUserData` → keep-data prompt on uninstall) |
| `assets/` | App icon set (full icon, adaptive foreground/background, monochrome, splash, favicon). Generated from simple SVG shapes (film frame + sun + hills on the accent blue); regenerate all files together if the logo changes |
| `docs/agent/` | Architecture, data format contract, roadmap |
| `docs/index.html`, `docs/privacy.html`, `docs/site.css` | Public GitHub Pages site (`https://akira-dude.github.io/plenka/`): home page and privacy policy required by the Google OAuth consent screen. Update the privacy policy when the app starts collecting or sending new data |

## Hard rules

1. **Files are the source of truth, SQLite is a rebuildable index.** Any post change goes through `src/storage/posts.ts` (`savePost`, `deletePost`), which writes `post.json` atomically, then the index row, then the outbox row. Never write post data only to SQLite.
2. **The on-disk format is a contract** (`docs/agent/data-format.md`): it must stay readable by a fresh install merging from the cloud. Changing a field → bump `POST_FORMAT` in `src/domain/post.ts`, update the doc, keep `parsePost` able to read old posts.
3. **Photos never depend on the system gallery.** Picked or captured images are always copied/converted into the post folder. Never store a gallery URI in a post.
4. **Never crop or change the aspect ratio of a stored photo.** Display-only framing lives in `src/ui/PhotoFrame.tsx`.
5. Routes in `src/app/` stay thin; non-route code goes to `src/domain`, `src/storage`, `src/ui`, `src/hooks`. Import via `@/…`.
6. No comments in code except a rare one-line note on a non-obvious platform quirk.
7. Android only. Do not add iOS/web-specific code paths.
8. **Colors only from the palette.** Styles are built as `const makeStyles = (c: Palette) => StyleSheet.create(...)` and used via `useStyles(makeStyles)`; never hardcode a color in a screen (exception: the always-black full-screen viewer).
9. The post number (`№ N`) is never written to `post.json`: it is the post's rank by `createdAt`, kept in the index column `posts.seq` and recomputed by `renumber()` inside every write transaction and after `rebuildIndex`. Read queries just select `seq` (no window functions on read: they cost ~50 ms per query at 20k posts).
10. Only `src/sync/` talks to the cloud, and only through `CloudStore` (never call `drive.ts` from engine or screens). Pushing only reads local files and never changes a post. Local files are written from the cloud in exactly two places: `mergeFromCloud` (newer `post.json` + thumbnails) and `fetchOriginal` (one original). After a screen saves or deletes a post it calls `syncNow(db)`.
11. **Forms scroll above the keyboard.** Android runs edge-to-edge, so the window does not resize for the keyboard: any screen with text inputs uses `KeyboardAwareScrollView` from `react-native-keyboard-controller` (`KeyboardProvider` is in the root layout) and keeps its primary action reachable (header button).

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
npx eas-cli@latest build -p android --profile preview   # cloud APK for installing on the phone
npx eas-cli@latest update --channel preview --environment preview --platform android --message "<what changed>" --non-interactive   # over-the-air update
```

**Shipping to the phone.** JS/TS-only changes (screens, logic, styles, texts) go out with `eas update` on channel `preview`; the app downloads them on launch and applies them on the next start (or via Settings → «Перезапустить и обновить»). A new APK (`eas build`) is required when the native side changes: a new or upgraded package with native code, `app.json` / config plugin changes (permissions, icon, plugins), or an Expo SDK upgrade. `runtimeVersion` uses the `fingerprint` policy, so an update built against a different native fingerprint is simply not offered to older APKs. When unsure, compare `npx expo-updates fingerprint:generate --platform android` before and after, or just build an APK. Tell the user which of the two they need. Before any new APK build check [roadmap → Open technical debt](docs/agent/roadmap.md#open-technical-debt): pending dependency fixes go into that build.

EAS project `@akira-dude/plenka` (id in `app.json` → `extra.eas.projectId`), profiles in `eas.json`: `preview` = installable APK, `production` = Play bundle. `versionCode` is managed remotely by EAS (`appVersionSource: remote`). The signing keystore lives on Expo servers; every update must be signed with it or it will not install over the old app (`eas credentials` to download a backup).

Run typecheck, lint and the bundle export before calling a task done: the export runs the Babel worklets plugin and catches errors tsc and lint miss (for example a spread inside a gesture hook config). `android/` is generated (CNG) and git-ignored: configure native things in `app.json` or `plugins/`, never by hand. Native modules need a dev build, not Expo Go.

## Keep docs current

When a change moves files, adds a module, changes the post format or finishes a roadmap item, update `AGENTS.md` / `docs/agent/*` in the same change. One fact — one place; link instead of copying.

The roadmap (`docs/agent/roadmap.md`) is part of every change: a finished item is deleted from it, a plan the user adds, changes or drops is written there the same turn, and every item stays tagged OTA or APK. Its own rules are at the top of the file.
