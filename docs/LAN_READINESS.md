# LAN readiness diagnostic

Run on a Windows or Linux host with Node.js 22+ after configuring the trusted HTTPS LAN proxy:

```bash
node scripts/check-lan.mjs https://locat.example.com
```

The hostname must resolve to a private routable address from that host. The script uses normal Node TLS validation, rejects HTTP and redirects, and checks that `/api/ready` returns the expected Locat application and schema-ready status.

A PASS confirms only DNS, HTTPS trust from the machine running the command, and backend readiness. It does not verify Android WebView trust, authentication, messaging, Docker on ARM64, or physical-device functionality. No insecure TLS override is supported.

For a local regression test, run `node --test scripts/check-lan.test.mjs` once that test file is present.
