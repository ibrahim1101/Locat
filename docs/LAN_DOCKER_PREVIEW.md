# Locat LAN preview

Run `docker compose -f compose.yaml -f compose.lan.yaml config --quiet` to validate the optional LAN HTTPS overlay. The overlay uses Caddy's internal CA, which requires explicit client trust. Android release compatibility and Raspberry Pi ARM64 deployment remain unverified.
