# LAN release sprint — 2026-10-12

Baseline: unified branch b849774. Checks 38158186898 and Remote checks 38158186909 passed. Existing af63b2c native builds passed packaging only.

Added opt-in compose.lan.yaml and deploy/lan/Caddyfile for LAN HTTPS through Caddy, preserving the existing app/database and persistent storage. See docs/LAN_DOCKER_PREVIEW.md.

BLOCKED: Android signed WebView trust for the local CA; requires a reviewed certificate solution. Windows Docker Desktop, Raspberry Pi 5 ARM64, native HTTPS connection, original UI feature parity and Cinema/Remote runtime remain NOT TESTED. Next: validate Compose on real hosts, restore UI/features, build and physically test Windows and Android previews. No main merge or live Pi changes.
