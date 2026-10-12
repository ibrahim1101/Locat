import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("optional trusted LAN HTTPS overlay", () => {
  const base = read("compose.yaml");
  const lan = read("compose.lan.yaml");
  const trusted = read("compose.lan.trusted.yaml");
  const caddy = read("deploy/lan/Caddyfile.trusted");

  it("keeps the existing database persistence and backend on loopback", () => {
    expect(base).toContain("locat-db:/var/lib/mysql");
    expect(base).toContain("127.0.0.1:3000:3000");
    expect(lan).toContain("443:443/tcp");
    expect(lan).toContain("${LOCAT_LAN_BIND_IP:-0.0.0.0}:443:443/tcp");
    expect(trusted).not.toMatch(/\bdb:\s*\n/);
    expect(trusted).not.toMatch(/\bapp:\s*\n/);
  });

  it("mounts operator-owned certificate and key read-only", () => {
    expect(trusted).toContain("LOCAT_CERT_DIR:?");
    expect(trusted).toContain("fullchain.pem:/certs/fullchain.pem:ro");
    expect(trusted).toContain("privkey.pem:/certs/privkey.pem:ro");
    expect(trusted).toContain("./deploy/lan/Caddyfile.trusted:/etc/caddy/Caddyfile:ro");
  });

  it("uses supplied TLS identity without any certificate bypass", () => {
    expect(caddy).toContain("https://{$LOCAT_LAN_HOST}");
    expect(caddy).toContain("tls /certs/fullchain.pem /certs/privkey.pem");
    expect(caddy).toContain("reverse_proxy app:3000");
    expect(caddy).not.toContain("tls internal");
    expect(caddy).not.toContain("tls_insecure_skip_verify");
  });
});
