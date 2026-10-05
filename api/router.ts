import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./authRouter";
import { usersRouter } from "./usersRouter";
import { conversationsRouter } from "./conversationsRouter";
import { messagesRouter } from "./messagesRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: authRouter,
  users: usersRouter,
  conversations: conversationsRouter,
  messages: messagesRouter,
});

export type AppRouter = typeof appRouter;
