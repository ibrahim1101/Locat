import { createRouter, publicQuery } from "./middleware";
import { adminRouter } from "./adminRouter";
import { pushRouter } from "./pushRouter";
import { authRouter } from "./authRouter";
import { usersRouter } from "./usersRouter";
import { conversationsRouter } from "./conversationsRouter";
import { messagesRouter } from "./messagesRouter";
import { sentinelRouter } from "./sentinelRouter";
import { linkRouter } from "./linkRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  push: pushRouter,
  admin: adminRouter,
  auth: authRouter,
  users: usersRouter,
  conversations: conversationsRouter,
  messages: messagesRouter,
  sentinel: sentinelRouter,
  link: linkRouter,
});

export type AppRouter = typeof appRouter;
