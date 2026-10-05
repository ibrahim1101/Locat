import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, like, or, desc, sql, lt, gt } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  users,
  sessions,
  conversations,
  conversationMembers,
  messages,
  sendReceipts,
  adminAudit,
  groupKeys,
  pushSubscriptions,
} from "@db/schema";
import { verifyPassword } from "./crypto";
import { limit } from "./rateLimit";
import { statfs } from "node:fs/promises";
import { uptime, totalmem, freemem } from "node:os";
import { randomBytes, scrypt, createCipheriv } from "node:crypto";
import { promisify } from "node:util";

const adminQuery = authedQuery.use(async ({ ctx, next }) => {
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, ctx.user.id),
  });
  if (!user?.isAdmin || user.disabled)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Administrator access required",
    });
  return next({ ctx: { ...ctx, user } });
});
async function reauthenticate(
  user: typeof users.$inferSelect,
  password: string
) {
  limit(`admin-password:${user.id}`, 10, 15 * 60000);
  if (!(await verifyPassword(password, user.passwordHash)))
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Incorrect administrator password",
    });
}
const confirmation = z.string().min(1).max(1024);
export const adminRouter = createRouter({
  access: authedQuery.query(async ({ ctx }) => {
    const user = await getDb().query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });
    return { allowed: !!user?.isAdmin && !user.disabled };
  }),
  users: adminQuery
    .input(
      z.object({
        search: z.string().max(64).default(""),
        page: z.number().int().min(0).max(100000).default(0),
      })
    )
    .query(async ({ input }) => {
      const search = `%${input.search.replace(/[\\%_]/g, "")}%`;
      const rows = await getDb()
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          disabled: users.disabled,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          or(like(users.username, search), like(users.displayName, search))
        )
        .orderBy(desc(users.id))
        .limit(51)
        .offset(input.page * 50);
      return { items: rows.slice(0, 50), hasMore: rows.length > 50 };
    }),
  stats: adminQuery.query(async () => {
    const db = getDb();
    const [accounts, activeSessions, groups, queue, database, disk] =
      await Promise.all([
        db
          .select({
            total: sql<number>`COUNT(*)`,
            disabled: sql<number>`COALESCE(SUM(${users.disabled}),0)`,
          })
          .from(users),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(sessions)
          .where(gt(sessions.expiresAt, new Date())),
        db.select({ total: sql<number>`COUNT(*)` }).from(conversations),
        db
          .select({
            total: sql<number>`COUNT(*)`,
            bytes: sql<number>`COALESCE(SUM(OCTET_LENGTH(${messages.envelope})),0)`,
          })
          .from(messages),
        db.execute(
          sql`SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH),0) AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
        ),
        statfs(process.cwd()).catch(() => null),
      ]);
    const dbRows = database[0] as unknown as { bytes: number }[];
    return {
      accounts: Number(accounts[0].total),
      disabledAccounts: Number(accounts[0].disabled),
      sessions: Number(activeSessions[0].total),
      conversations: Number(groups[0].total),
      queuedMessages: Number(queue[0].total),
      queueBytes: Number(queue[0].bytes),
      databaseBytes: Number(dbRows[0]?.bytes ?? 0),
      diskFreeBytes: disk ? disk.bavail * disk.bsize : null,
      diskTotalBytes: disk ? disk.blocks * disk.bsize : null,
      memoryFreeBytes: freemem(),
      memoryTotalBytes: totalmem(),
      uptimeSeconds: Math.floor(uptime()),
      database: "ready",
    };
  }),
  accountAction: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        action: z.enum(["disable", "enable", "revoke-sessions"]),
        password: confirmation,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await reauthenticate(ctx.user, input.password);
      if (input.userId === ctx.user.id)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Use the server terminal to change your own administrator account.",
        });
      await getDb().transaction(async tx => {
        const [target] = await tx
          .select({ id: users.id, isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, input.userId))
          .for("update");
        if (!target) throw new TRPCError({ code: "NOT_FOUND" });
        if (target.isAdmin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Administrator accounts are managed from the server terminal.",
          });
        if (input.action !== "revoke-sessions")
          await tx
            .update(users)
            .set({ disabled: input.action === "disable" })
            .where(eq(users.id, input.userId));
        if (input.action !== "enable") {
          await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId,input.userId));
          await tx.delete(sessions).where(eq(sessions.userId,input.userId));
        }
        await tx.insert(adminAudit).values({
          actorId: ctx.user.id,
          action: input.action,
          targetId: input.userId,
        });
      });
      return { ok: true };
    }),
  audit: adminQuery
    .input(z.object({ page: z.number().int().min(0).max(100000).default(0) }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(adminAudit)
        .orderBy(desc(adminAudit.id))
        .limit(51)
        .offset(input.page * 50);
      return { items: rows.slice(0, 50), hasMore: rows.length > 50 };
    }),
  cleanup: adminQuery
    .input(z.object({ password: confirmation }))
    .mutation(async ({ ctx, input }) => {
      await reauthenticate(ctx.user, input.password);
      await getDb().transaction(async tx => {
        await tx.execute(
          sql`DELETE p FROM push_subscriptions p LEFT JOIN sessions s ON s.token=p.session_token WHERE s.id IS NULL OR s.expires_at<NOW()`
        );
        await tx.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        await tx
          .delete(sendReceipts)
          .where(
            lt(sendReceipts.createdAt, new Date(Date.now() - 7 * 86400000))
          );
        await tx
          .delete(messages)
          .where(lt(messages.createdAt, new Date(Date.now() - 30 * 86400000)));
        await tx
          .insert(adminAudit)
          .values({ actorId: ctx.user.id, action: "cleanup" });
      });
      return { ok: true };
    }),
  backup: adminQuery
    .input(
      z.object({
        password: confirmation,
        backupPassword: z.string().min(12).max(1024),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await reauthenticate(ctx.user, input.password);
      limit("admin-backup", 5, 60000);
      const metadata = await getDb().transaction(async tx => {
        const [accountSize] = await tx
          .select({
            bytes: sql<number>`COALESCE(SUM(OCTET_LENGTH(${users.publicKey}) + OCTET_LENGTH(${users.encryptedPrivateKey}) + 1024),0)`,
          })
          .from(users);
        const [memberSize] = await tx
          .select({
            bytes: sql<number>`COALESCE(SUM(COALESCE(OCTET_LENGTH(${conversationMembers.wrappedKey}),0) + 512),0)`,
          })
          .from(conversationMembers);
        const [keySize] = await tx
          .select({
            bytes: sql<number>`COALESCE(SUM(OCTET_LENGTH(${groupKeys.wrappedKey}) + OCTET_LENGTH(${groupKeys.wrapperPublicKey}) + 256),0)`,
          })
          .from(groupKeys);
        if (
          Number(keySize.bytes) +
            Number(accountSize.bytes) +
            Number(memberSize.bytes) >
          20_000_000
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Use the server-terminal backup for this database size.",
          });
        const accounts = await tx.select().from(users).limit(10001);
        const chats = await tx.select().from(conversations).limit(10001);
        const versions = await tx.select().from(groupKeys).limit(100001);
        const members = await tx
          .select()
          .from(conversationMembers)
          .limit(100001);
        if (
          accounts.length > 10000 ||
          chats.length > 10000 ||
          members.length > 100000 ||
          versions.length > 100000
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Use the server-terminal backup for this database size.",
          });
        await tx
          .insert(adminAudit)
          .values({ actorId: ctx.user.id, action: "metadata-backup" });
        return {
          version: 1,
          createdAt: new Date().toISOString(),
          accounts,
          conversations: chats,
          members,
          groupKeys: versions,
        };
      });
      const plain = Buffer.from(JSON.stringify(metadata));
      if (plain.length > 20_000_000)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use the server-terminal backup for this database size.",
        });
      const salt = randomBytes(16),
        iv = randomBytes(12);
      const key = (await promisify(scrypt)(
        input.backupPassword,
        salt,
        32
      )) as Buffer;
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from("Locat server metadata v1"));
      const data = Buffer.concat([cipher.update(plain), cipher.final()]);
      return JSON.stringify({
        app: "Locat server metadata",
        version: 1,
        kdf: "scrypt-16384-8-1",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64"),
      });
    }),
});
