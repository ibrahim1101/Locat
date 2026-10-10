import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { handleSentinelWebhook } from "./sentinel/webhook";
import { handleMediaStream } from "./mediaStream";
import { handleMediaHls } from "./mediaHls";

const app = new Hono<{ Bindings: HttpBindings }>();
app.use("/api/*", cors({
  origin: origin => origin === "https://localhost" ? origin : "",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "DENY");
  if (c.req.path.startsWith("/api/") || c.req.path === "/sw.js" || c.req.path === "/index.html") c.header("Cache-Control", "no-store");
});

app.get("/api/health", (c) => c.json({ app: "Locat", status: "ok" }));
app.get("/api/ready", async (c) => {
  try {
    await getDb().execute(sql`SELECT id, is_admin, bio, avatar, lc_code, username_visibility, profile_visibility, presence_visibility, allow_avatar_download FROM users LIMIT 0`);
    await getDb().execute(sql`SELECT client_message_id FROM messages LIMIT 0`);
    await getDb().execute(sql`SELECT id FROM send_receipts LIMIT 0`);
    await getDb().execute(sql`SELECT id FROM user_blocks LIMIT 0`);
    await getDb().execute(sql`SELECT id FROM contact_relationships LIMIT 0`);
    await getDb().execute(sql`SELECT group_epoch, rotation_required FROM conversations LIMIT 0`);
    await getDb().execute(sql`SELECT id FROM group_keys LIMIT 0`);
    await getDb().execute(sql`SELECT id FROM push_subscriptions LIMIT 0`);
    return c.json({ app: "Locat", status: "ready" });
  } catch { return c.json({ app: "Locat", status: "database unavailable or schema missing" }, 503); }
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
// Locat Sentinel inbound webhook — authenticated by scoped integration token
// (never a user session), mounted before the tRPC handler and the catch-all.
app.post("/api/sentinel/webhook", handleSentinelWebhook);
app.on(["GET", "HEAD"], "/api/media/stream", c => handleMediaStream(c.req.raw));
app.get("/api/media/hls", c => handleMediaHls(c.req.raw));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
  const hostname = process.env.HOST || "127.0.0.1";
  serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`Locat running on http://${hostname}:${port}/`);
  });
}
