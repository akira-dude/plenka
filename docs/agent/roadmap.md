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

Nothing planned right now.

### APK

- **Background sync** while the app is closed (`expo-background-task`).
- **Expo SDK patch bump** — see «Open technical debt».

### Later

- **Home server backend** (the user's own always-on box, assembled 2026-11-04: i7-3770, GA-B75-D3V, 16 GB, 256 GB mSATA SSD for the system, 4 TB IronWolf for data with LUKS + btrfs, Ippon UPS; OpenMediaVault 8 with Docker; no discrete GPU, the GTX 1060 was sold, so installs need a monitor on the onboard video). Reachable directly: the ISP gave a static public IP, the user will buy a domain, HTTPS is terminated by Caddy on the server — no VPS. Leaning to WebDAV (path-based, maps onto `CloudStore`), which is plain HTTP → OTA. Never write the home IP or credentials into this public repo. Network constraints (user is in Russia): plain WireGuard is DPI-blocked or unstable and Cloudflare is unreliable, so do not plan on either; remote admin goes through AmneziaWG with a keys-only SSH fallback, and the app itself uses plain HTTPS on 443.

- **Home server maintenance** (set up 2026-11-06). Container images are pinned to exact tags in `appdata/<service>/compose.yaml` on the encrypted data disk; once a month, or right after a security fix, bump the tag, `docker compose pull && docker compose up -d`, check the service. qBittorrent runs as the share user (PUID 1000), no-new-privileges, only `/downloads` and `/config` mounted, web UI bound to the LAN address, peer port 6881 TCP/UDP forwarded on the router, encryption required, anonymous mode on, seeding stops at ratio 2 or 24 h. Docker does not start at boot: `docker-when-unlocked.timer` starts it once the LUKS disk is unlocked and mounted. Monitoring: OMV scheduled btrfs snapshots (read-only, `.snapshots`, shown as Windows Previous Versions), monthly scrub, smartd tests, `nas-healthcheck.timer` (locked disk, SMART deltas, btrfs errors, snapshot age, free space) mailing through Gmail; Telegram is unreachable from the server. UPS: Ippon Back Basic 650 over a CH340 serial adapter, NUT `nutdrv_qx` megatec, shutdown after 300 s on battery, `OMV_NUT_UPSD_MAXAGE` / `OMV_NUT_UPSMON_DEADTIME` = 60 in `/etc/default/openmediavault` because the UPS stops answering for ~15 s on battery (with the default 15 s NUT shut the server down at once), `nas-ups-mute.service` mutes the beeper on every switch to battery (it cannot be disabled for good). Torrent traffic is not behind a VPN by the user's choice; if that changes, use a gluetun container with a P2P provider that supports port forwarding.
- **Home server stress test** (requested 2026-11-04, after everything is set up). Run each scenario and write down what happened:
  - Power cut: pull the UPS plug → NUT waits, then shuts the server down cleanly, the UPS cuts its output → power back → server boots by itself (`AC BACK`) → disk stays locked until the user unlocks it → services come back.
  - Short power blip (under the NUT delay): nothing should shut down.
  - Internet loss: unplug the WAN cable → LAN keeps working, Plenka queues uploads and sends them after reconnect, the remote-admin tunnel reconnects by itself.
  - Router reboot: server gets the same LAN address (DHCP reservation), port forwards still work.
  - External attack from outside the LAN: full port scan (only 80/443 TCP, the AmneziaWG UDP port and the SSH fallback port may answer), SSH password login must be refused, brute force on SSH and on the Plenka WebDAV login gets banned, admin UI and SMB unreachable from outside.
  - Alarm triggers: unknown USB device, new system user, unexpected open port → Telegram message + shutdown, and the server stays off and locked; Telegram `/off` panic command works.
  - Data safety: restore a deleted file from a btrfs snapshot, run a scrub, check SMART alerts reach the user.
  - How the IP looks to RKN-style active probing: check the IP on Censys and with an outside `nmap -p- -sV` scan. Expected: only our HTTPS with a certificate for our own domain and a real page behind it, the SSH fallback port, nothing that answers like a proxy or impersonates another site. Never run circumvention software (Xray/VLESS, open proxies) on this server.

## Open technical debt

Temporary notes. When an item is resolved, delete its entry here and every pointer to it (`AGENTS.md` → «Shipping to the phone») in the same commit.

- **Expo SDK patch mismatch (noted 2026-10-27).** The EAS build of 0.6.0 (versionCode 6) reported `expo-doctor` 19/20: `expo` 58.0.19 → ~58.0.20, `expo-file-system` 58.0.11 → ~58.0.12, `expo-router` 58.0.26 → ~58.0.27. The patches came out while the build was queued; the build itself is fine. Deliberately not fixed yet: `expo` and `expo-file-system` carry native code, so bumping them changes the runtime fingerprint and forces a new APK. Fix it in the next build that needs a new APK anyway: `npx expo install --fix`, then `npx expo-doctor` must show 20/20, then typecheck, lint, bundle export, `eas build`. After that, remove this entry and the pointer in `AGENTS.md`.
