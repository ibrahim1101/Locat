# LAN first, optional Tailscale invitations

User requirement, 2026-10-12: every implemented Locat feature must be usable
by authorized devices on the same LAN without installing Tailscale. Invited
outside devices use Tailscale to reach the same host, accounts, database and
feature APIs. This is the networking requirement for future features too;
unimplemented features in the feature matrix remain unimplemented.

## One identity, two routes

Keep one canonical HTTPS hostname and one `PUBLIC_ORIGIN`. On the LAN,
local DNS resolves it to the host's reserved LAN IP. Outside the LAN,
Tailscale MagicDNS resolves the same host's fully qualified `.ts.net` name
to its tailnet address. Both proxies terminate trusted HTTPS and forward to
the existing Locat backend. Keep using this hostname in every client.

This matters because encrypted local drafts, scheduled copies, private
stores and browser sessions are scoped to a server origin. Switching
between a LAN IP URL and a different tailnet URL creates different origins;
it does not automatically migrate local data. Local DNS configuration is
required for the shared-name design, not automatic LAN discovery.

## Host setup (operator managed)

A concrete shared-name option is the host's actual fully qualified Tailscale
name, such as `locat.your-tailnet.ts.net`. Replace this example everywhere.
Enable MagicDNS and HTTPS certificates in the host's tailnet. Obtain a
trusted certificate for that exact name using `tailscale cert`, writing the
certificate as `fullchain.pem` and its private key as `privkey.pem` in a
restricted directory outside the repository. Consult `tailscale cert --help`
for the installed version's output-file flags. Exported certificates require
operator-managed renewal and a proxy reload after renewal. Certificate
issuance publishes the machine's certificate name in public transparency logs.

In the existing private `.env`, set these values without replacing database
credentials:

```dotenv
LOCAT_LAN_HOST=locat.your-tailnet.ts.net
PUBLIC_ORIGIN=https://locat.your-tailnet.ts.net
LOCAT_LAN_BIND_IP=192.168.1.10
LOCAT_CERT_DIR=/srv/locat-certs
```

Use the host's actual reserved LAN IPv4 address and certificate directory.
`LOCAT_LAN_BIND_IP` binds the Docker LAN proxy to that interface, leaving
Tailscale's interface available for Serve. The default `0.0.0.0` preserves
existing LAN-only behavior; set the reserved LAN IP when enabling both.
Docker Desktop interface publishing must be verified on the actual host.

Configure the LAN router/local DNS with an exact hostname override mapping
`locat.your-tailnet.ts.net` to the reserved LAN IP. Clients must use that
resolver; encrypted DNS settings can bypass router overrides. LAN clients
need neither Tailscale nor an active tailnet connection. A LAN device with
Tailscale enabled may prefer its MagicDNS route; turn off Tailscale during
LAN acceptance to demonstrate independent access.

Start the existing single stack with the trusted HTTPS overlay:

```bash
docker compose -f compose.yaml -f compose.lan.yaml -f compose.lan.trusted.yaml config --quiet
docker compose -f compose.yaml -f compose.lan.yaml -f compose.lan.trusted.yaml up -d --build
```

On that host, expose the existing loopback backend privately through Serve:

```bash
tailscale serve --bg 3000
tailscale serve status
```

Do not start a second backend/database for outside clients. Restrict LAN
TCP 443 at the host firewall to the intended LAN. Keep backend port 3000
loopback-only and the database unpublished. This recipe combines supported
proxy/DNS mechanisms; physical Windows, Android and Pi coexistence is not
yet verified by this project.

## Invite and remove outside access

Use Tailscale's machine-sharing invitation for the Locat host when inviting
someone from another tailnet. The recipient accepts the invitation and uses
the full hostname above; short machine names do not work for shared nodes.
Apply tailnet access policy to HTTPS on this host. Sharing a machine grants
network reachability, not a Locat account, group membership, Link ownership
or Remote control approval. Existing Locat authentication and feature-level
permissions still apply. Do not use proxy identity headers as Locat login.

Remove the share/grant to remove outside network access. Remove the Locat
account/membership separately if application access should also end. A
Tailscale invitation does not replace application authorization or approval.
Use private Serve; public Funnel is not part of this deployment design.

## Readiness and feature acceptance

From a LAN computer with Tailscale disabled:

```bash
node scripts/check-lan.mjs https://locat.your-tailnet.ts.net
```

From an invited outside computer with Tailscale connected:

```bash
node scripts/check-lan.mjs https://locat.your-tailnet.ts.net --tailscale
```

Both checks use normal TLS validation and the same `/api/ready` endpoint.
The default rejects tailnet addresses, proving that the check did not take
that route. The optional check accepts only Tailscale IPv4 address space;
it is not proof of invitation identity or ACL correctness and does not yet
support tailnet IPv6. Neither check proves full feature or device acceptance.

For each implemented feature, acceptance must exercise LAN first, then the
invited path, including reconnect, encrypted messaging, attachments, Link,
Cinema, Music and approved Remote sessions where supported. Verify a
device switching networks still uses the same server hostname and local
identity. New calls/discovery/media transports must work on LAN without
requiring a Tailscale IP or cloud relay; needed remote relay services should
be optional and explicit. Host-dependent features still require the host
online; optional internet integrations retain their own dependencies.

## References

- [Tailscale machine sharing](https://tailscale.com/docs/features/sharing)
- [Tailscale HTTPS certificates](https://tailscale.com/docs/how-to/set-up-https-certificates)
- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- [Serve command reference](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Trusted Locat LAN overlay](LAN_TRUSTED_HTTPS_PREVIEW.md)
- [Actual implementation matrix](LOCAT_COMPLETE_FEATURE_MATRIX.md)
