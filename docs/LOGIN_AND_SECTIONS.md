# Login and sections

Unauthenticated launches and deep links show login. A native installation without a configured server also shows login, with sign-in disabled until a server is connected. Existing valid sessions can restore without entering credentials again; this does not introduce an offline password verifier. New logins and registrations require the account server.

After authentication, `/` opens the section dashboard; `/messages` still opens conversations. All registered sections remain visible. Planned sections stay disabled, administrator sections require authorization, and Messages, Link, Sentinel, Vault and Secrets require a schema-ready server. Cinema, Music, Search, Performance and the separate-host Remote prototype remain available in an existing authenticated offline session. Remote still needs its own approved host.

The bottom-left server control opens the HTTPS address form. Native apps validate `/api/ready` before saving and reloading; changing origins clears the old bearer token and keeps account archives scoped to their original server. Browser changes navigate to the selected HTTPS origin, preserving browser origin isolation; cross-origin readiness checks require that server to allow the request. Certificate validation is never bypassed. Readiness is checked every 15 seconds and on network reconnection; disconnected server sections remain visible but disabled.

LAN and optional private Tailscale access use the same canonical trusted HTTPS server origin. No automatic LAN discovery is claimed. Physical Android layout/keyboard and device lifecycle acceptance remain pending.

Attachment pictures now offer crop presets, crop position, zoom, quarter-turn rotation, preview, reset and original/edited send. Edits produce a new still JPEG up to 1600 pixels; animation and transparency are not preserved. Original files remain unchanged. Browser pixel tests verify crop, rotation and JPEG export, while device codec/memory acceptance remains open.
