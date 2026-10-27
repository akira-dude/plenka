# Плёнка

Личный фотодневник для Android, работает без интернета. Каждая запись хранится на телефоне как папка: `post.json` с текстом и фотографии. Копия уходит в Google Drive, и оттуда дневник можно вернуть на телефон.

Этот файл для людей: как поднять проект с нуля, как выпустить новую версию и где искать то, что работает на чужих серверах. Устройство кода и правила разработки описаны в [AGENTS.md](AGENTS.md) и [docs/agent](docs/agent/INDEX.md).

## Где что живёт

| Что | Где | Зачем |
| --- | --- | --- |
| Код | GitHub [akira-dude/plenka](https://github.com/akira-dude/plenka), ветка `main` | Всё, кроме папки `android/`: она генерируется при сборке и в репозиторий не попадает |
| Сайт | GitHub Pages: https://akira-dude.github.io/plenka/ (собирается из папки `docs/` ветки `main`) | Главная и [политика конфиденциальности](https://akira-dude.github.io/plenka/privacy.html), нужна Google. Ещё этот адрес служит «адресом страницы» для карты: без него OpenStreetMap не отдаёт тайлы (`MAP_BASE_URL` в `src/ui/mapHtml.ts`) |
| Сборки APK | Expo, аккаунт `akira-dude`, проект `@akira-dude/plenka`: https://expo.dev/accounts/akira-dude/projects/plenka/builds | Облачная сборка APK, ссылки на скачивание и QR-коды |
| Ключ подписи | Expo → проект → Credentials (`npx eas-cli@latest credentials -p android`) | Хранится только на серверах Expo. Обновление, подписанное другим ключом, не встанет поверх старого. Резервную копию скачивает та же команда |
| Номер сборки | Expo (`appVersionSource: remote` в `eas.json`) | `versionCode` растёт сам при каждой сборке |
| Обновления по воздуху | Expo → проект → Updates: https://expo.dev/accounts/akira-dude/projects/plenka/updates | Канал `preview`. Приложение проверяет его при запуске |
| Вход в Google и Drive | Google Cloud Console, проект `Plenka`: https://console.cloud.google.com | Включён Google Drive API. Экран согласия OAuth опубликован, доступ `drive.file` (приложение видит только свои файлы). Два OAuth-клиента: **Web** (его id записан в `src/sync/auth.ts`) и **Android** (пакет `dev.akiradude.plenka` + SHA-1 ключа подписи из Expo) |
| Данные дневника | Google Drive пользователя, папка «Плёнка» | Копия всех записей в том же формате, что на телефоне ([формат](docs/agent/data-format.md)) |
| Карта | Тайлы OpenStreetMap, библиотека Leaflet с unpkg.com | Без аккаунта и ключей |

Ключи и пароли в репозиторий не кладутся. Id Web-клиента Google секретом не считается.

## Поднять с нуля

Нужны Node.js (проверено на 24), git и аккаунт Expo с доступом к проекту `akira-dude/plenka`.

```bash
git clone https://github.com/akira-dude/plenka.git
```

```bash
cd plenka
```

```bash
npm ci
```

```bash
npx eas-cli@latest login
```

Дальше два пути.

**APK из облака.** Android SDK не нужен. Сборка идёт 10–30 минут, в конце будет ссылка на APK:

```bash
npx eas-cli@latest build -p android --profile preview
```

APK ставится на телефон поверх старой версии, записи сохраняются.

**Отладочная сборка на телефоне по USB.** Нужны Android SDK, JDK и телефон с включённой отладкой. Expo Go не подойдёт:

```bash
npm run android
```

Такая сборка подписана отладочным ключом, поэтому вход в Google в ней не заработает (`DEVELOPER_ERROR`, код 10). Чтобы заработал, в Google Cloud нужен ещё один Android-клиент с SHA-1 отладочного ключа.

## Выпуск новой версии

Сначала проверки:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run doctor
```

Потом один из двух способов.

- **Обновление по воздуху.** Подходит, если менялись только экраны, логика и тексты. Телефон скачает обновление при запуске и применит при следующем открытии, или сразу по кнопке в Настройки → «Приложение».

  ```bash
  npx eas-cli@latest update --channel preview --environment preview --platform android --message "что изменилось"
  ```

- **Новый APK.** Нужен, если добавлена или обновлена библиотека с нативным кодом, поменялся `app.json` (иконка, разрешения, плагины) или вышла новая версия Expo SDK. Собирается командой `build` из раздела выше.

Если не уверен, сравни отпечаток нативной части до и после изменений. Совпал — хватит обновления по воздуху, не совпал — нужен APK. Обновление с другим отпечатком на старый APK просто не придёт и ничего не сломает.

```bash
npx expo-updates fingerprint:generate --platform android
```

Что запланировано и что из этого требует APK: [docs/agent/roadmap.md](docs/agent/roadmap.md).

## Если что-то сломалось

- **Не входит в Google (`DEVELOPER_ERROR`).** SHA-1 ключа, которым подписан APK, не совпадает с Android-клиентом в Google Cloud. Посмотреть SHA-1: `npx eas-cli@latest credentials -p android`.
- **Google пишет «приложение не проверено» или не пускает.** Проверь в Google Cloud Console, что экран согласия опубликован, а Drive API включён.
- **Пропал или сменился телефон.** Поставь APK, открой пустую ленту и нажми «Восстановить из Google Drive». Записи скачаются, полные фото подтянутся при открытии.
- **Потерян ключ подписи в Expo.** Новый APK не встанет поверх старого: старое приложение придётся удалить, а записи вернуть из Drive. Поэтому резервную копию ключа лучше хранить у себя.
- **Карта пустая.** Проверь, что открывается https://akira-dude.github.io/plenka/: без этого адреса OpenStreetMap не отдаёт тайлы.
