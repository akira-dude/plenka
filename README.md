# Плёнка

Личный фотодневник для Android, который работает без интернета. Каждая запись хранится на телефоне как папка с `post.json` и фотографиями; позже копия будет уходить в Google Drive.

## Запуск

```bash
npm install
npm run android
```

Нужны Android SDK, JDK и телефон с включённой отладкой по USB. Expo Go не подойдёт: приложению нужна dev-сборка.

APK без Android SDK собирается в облаке Expo (нужен вход: `npx eas-cli@latest login`):

```bash
npx eas-cli@latest build -p android --profile preview
```

Проверки: `npm run typecheck`, `npm run lint`, `npm run doctor`.

Устройство проекта и правила для разработки: [AGENTS.md](AGENTS.md) и [docs/agent](docs/agent/INDEX.md).
