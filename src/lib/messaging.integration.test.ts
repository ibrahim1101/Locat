import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { spawnSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { generateIdentity, wrapPrivateKeyForBackup, deriveDirectKey, encryptPayload, decryptPayload, generateGroupKey, wrapGroupKey, unwrapGroupKey } from "./crypto";
import type { appRouter as Router } from "../../api/router";
import type { getDb as GetDb } from "../../api/queries/connection";
import type * as Schema from "../../db/schema";

const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("MariaDB messaging integration", () => {
  let connection: Connection;
  let db: ReturnType<typeof GetDb>;
  let schema: typeof Schema;
  let router: typeof Router;
  let alice: ReturnType<typeof Router.createCaller>;
  let bob: ReturnType<typeof Router.createCaller>;
  let outsider: ReturnType<typeof Router.createCaller>;
  let aliceId: number;
  let bobId: number;
  let conversationId: number;
  let envelope: string;
  let receivingKey: CryptoKey;
  let identities: Awaited<ReturnType<typeof generateIdentity>>[];

  function setup() {
    const result = spawnSync(process.execPath, ["scripts/setup-db.mjs"], {
      env: { ...process.env, DATABASE_URL: databaseUrl! }, encoding: "utf8",
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  }
  async function count(table: string) {
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table}`);
    return Number(rows[0].n);
  }

  beforeAll(async () => {
    // Integration tests require a dedicated, disposable database explicitly named *_test.
    if (!new URL(databaseUrl!).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL must point to a disposable *_test database");
    process.env.DATABASE_URL = databaseUrl;
    connection = await mysql.createConnection(databaseUrl!);
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of ["group_keys", "push_subscriptions", "admin_audit", "send_receipts", "message_deliveries", "messages", "conversation_members", "conversations", "sessions", "users"]) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    setup(); setup();
    ({ appRouter: router } = await import("../../api/router"));
    schema = await import("../../db/schema");
    db = (await import("../../api/queries/connection")).getDb();
    const publicCaller = router.createCaller({ req: new Request("http://localhost"), resHeaders: new Headers() });
    identities = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
    const callers = [];
    for (const [index, username] of ["alice", "bob", "outsider"].entries()) {
      const keys = identities[index];
      const backup = await wrapPrivateKeyForBackup(keys, "test-password-long");
      const registered = await publicCaller.auth.register({ username, displayName: username,
        password: "test-password-long", keys: { publicKey: keys.publicKeyB64, ...backup } });
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, registered.user.id) });
      callers.push(router.createCaller({ req: new Request("http://localhost"), resHeaders: new Headers(), user,
        sessionToken: registered.token }));
      if (username === "alice") aliceId = registered.user.id;
      if (username === "bob") bobId = registered.user.id;
    }
    [alice, bob, outsider] = callers;
    const simultaneous = await Promise.all([
      alice.conversations.createDirect({ userId: bobId }), bob.conversations.createDirect({ userId: aliceId }),
    ]);
    expect(simultaneous[0].conversationId).toBe(simultaneous[1].conversationId);
    conversationId = simultaneous[0].conversationId;
    const sendingKey = await deriveDirectKey(identities[0].privateKey, identities[1].publicKeyB64, aliceId, bobId);
    receivingKey = await deriveDirectKey(identities[1].privateKey, identities[0].publicKeyB64, bobId, aliceId);
    envelope = await encryptPayload(sendingKey, { type: "text", text: "end-to-end integration" });
  }, 20000);
  afterAll(async () => {
    if (db) await db.$client.end();
    if (connection) await connection.end();
  });

  it("registers/login and reuses an existing direct conversation", async () => {
    expect((await alice.auth.login({ username: "alice", password: "test-password-long" })).user.id).toBe(aliceId);
    await expect(alice.auth.login({ username: "alice", password: "wrong" })).rejects.toThrow("Invalid username");
    expect(await bob.conversations.createDirect({ userId: aliceId })).toEqual({ conversationId, created: false });
  });

  it("updates a public profile and finds it by exact account code", async () => {
    expect(await alice.users.updateProfile({ displayName: "Alice Example", bio: "Private chat enthusiast" }))
      .toEqual({ displayName: "Alice Example", bio: "Private chat enthusiast" });
    const results = await bob.users.search({ q: `LC-${aliceId}` });
    expect(results).toEqual([expect.objectContaining({
      id: aliceId, displayName: "Alice Example", bio: "Private chat enthusiast",
    })]);
    expect(await bob.users.search({ q: "LC-0" })).toEqual([]);
  });

  it("rejects cross-origin mutations and disabled accounts, and retires older sessions", async () => {
    const { createContext } = await import("../../api/context");
    const first = await alice.auth.login({ username: "alice", password: "test-password-long" });
    const second = await alice.auth.login({ username: "alice", password: "test-password-long" });
    const oldContext = await createContext({ req: new Request("http://localhost", { headers: { authorization: `Bearer ${first.token}` } }), resHeaders: new Headers(), info: {} as never });
    expect(oldContext.user).toBeUndefined();
    const crossOrigin = router.createCaller({ req: new Request("http://localhost", { headers: { origin: "https://untrusted.example" } }), resHeaders: new Headers() });
    await expect(crossOrigin.auth.login({ username: "alice", password: "test-password-long" })).rejects.toThrow("origin");
    await db.update(schema.users).set({ disabled: true }).where(eq(schema.users.id, aliceId));
    await expect(alice.auth.login({ username: "alice", password: "test-password-long" })).rejects.toThrow("Invalid username");
    const disabled = await createContext({ req: new Request("http://localhost", { headers: { authorization: `Bearer ${second.token}` } }), resHeaders: new Headers(), info: {} as never });
    expect(disabled.user).toBeUndefined();
    await db.update(schema.users).set({ disabled: false }).where(eq(schema.users.id, aliceId));
  });

  it("delivers ciphertext, enforces membership, and purges only after every acknowledgement", async () => {
    const sent = await alice.messages.send({ conversationId, envelope, clientMessageId: crypto.randomUUID() });
    const page = await bob.messages.sync({ after: 0 });
    expect(page.items).toHaveLength(1);
    expect(await decryptPayload(receivingKey, page.items[0].envelope)).toEqual({ type: "text", text: "end-to-end integration" });
    await expect(outsider.messages.send({ conversationId, envelope, clientMessageId: crypto.randomUUID() })).rejects.toThrow("Not a member");
    expect(await outsider.messages.ack({ messageIds: [sent.messageId] })).toEqual({ purged: 0 });
    expect(await bob.messages.ack({ messageIds: [sent.messageId] })).toEqual({ purged: 0 });
    expect(await count("messages")).toBe(1);
    expect(await alice.messages.ack({ messageIds: [sent.messageId] })).toEqual({ purged: 1 });
    expect(await count("messages")).toBe(0);
  });

  it("deduplicates retries even after the transient message has been deleted", async () => {
    const clientMessageId = crypto.randomUUID();
    const input = { conversationId, envelope, clientMessageId };
    const [first, second] = await Promise.all([alice.messages.send(input), alice.messages.send(input)]);
    expect(first.messageId).toBe(second.messageId);
    expect(await count("messages")).toBe(1);
    await bob.messages.ack({ messageIds: [first.messageId] });
    await alice.messages.ack({ messageIds: [first.messageId] });
    expect((await alice.messages.send(input)).messageId).toBe(first.messageId);
    expect(await count("messages")).toBe(0);
    await expect(alice.messages.send({ ...input, envelope: "different" })).rejects.toThrow("does not match");
  });

  it("rolls back the envelope and receipts when delivery creation fails", async () => {
    const receiptsBefore = await count("send_receipts");
    await connection.query("CREATE TRIGGER locat_test_fail_delivery BEFORE INSERT ON message_deliveries FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test failure'");
    try {
      await expect(alice.messages.send({ conversationId, envelope, clientMessageId: crypto.randomUUID() })).rejects.toThrow();
      expect(await count("messages")).toBe(0);
      expect(await count("message_deliveries")).toBe(0);
      expect(await count("send_receipts")).toBe(receiptsBefore);
    } finally { await connection.query("DROP TRIGGER locat_test_fail_delivery"); }
  });

  it("paginates a backlog beyond the previous 500-message cap", async () => {
    const ids = [];
    for (let index = 0; index < 505; index++) {
      const [{ id }] = await db.insert(schema.messages).values({ conversationId, senderId: aliceId, envelope }).$returningId();
      ids.push(id);
    }
    await db.insert(schema.messageDeliveries).values(ids.map((messageId) => ({ messageId, recipientId: bobId })));
    let after = 0;
    const received: number[] = [];
    do {
      const page = await bob.messages.sync({ after });
      received.push(...page.items.map((m) => m.messageId));
      expect(page.items.length).toBeLessThanOrEqual(50);
      if (page.nextCursor === null) break;
      after = page.nextCursor;
    } while (received.length < ids.length);
    expect(received).toEqual(ids);
    await bob.messages.ack({ messageIds: ids.slice(0, 500) });
    await bob.messages.ack({ messageIds: ids.slice(500) });
    expect(await count("messages")).toBe(0);
  }, 20000);

  it("upgrades an original schema without losing accounts or messages", async () => {
    const sent = await alice.messages.send({ conversationId, envelope, clientMessageId: crypto.randomUUID() });
    const accountsBefore = await count("users");
    // The original schema has an implicit sender FK index rather than the new retry index.
    await connection.query("CREATE INDEX legacy_sender_idx ON messages(sender_id)");
    await connection.query("ALTER TABLE messages DROP INDEX messages_sender_client_unique, DROP COLUMN client_message_id");
    await connection.query("DROP TABLE send_receipts");
    setup(); setup();
    expect(await count("users")).toBe(accountsBefore);
    expect((await bob.messages.sync({ after: 0 })).items[0].messageId).toBe(sent.messageId);
  });

  it("limits media response size without stranding the next page", async () => {
    const previous = await bob.messages.sync({ after: 0 });
    await bob.messages.ack({ messageIds: previous.items.map((m) => m.messageId) });
    await alice.messages.ack({ messageIds: previous.items.map((m) => m.messageId) });
    const ids = [];
    for (let index = 0; index < 3; index++) {
      const [{ id }] = await db.insert(schema.messages).values({ conversationId, senderId: aliceId,
        envelope: "x".repeat(4_000_000) }).$returningId();
      ids.push(id);
    }
    await db.insert(schema.messageDeliveries).values(ids.map((messageId) => ({ messageId, recipientId: bobId })));
    const first = await bob.messages.sync({ after: 0 });
    expect(first.items.map((m) => m.messageId)).toEqual(ids.slice(0, 2));
    const second = await bob.messages.sync({ after: first.nextCursor! });
    expect(second.items.map((m) => m.messageId)).toEqual(ids.slice(2));
    expect(second.nextCursor).toBeNull();
  });

  it("rolls back a group when membership insertion fails", async () => {
    const before = await count("conversations");
    await connection.query("CREATE TRIGGER locat_test_fail_membership BEFORE INSERT ON conversation_members FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test failure'");
    try {
      await expect(alice.conversations.createGroup({ name: "Test group", memberIds: [bobId],
        wrappedKeys: [{ userId: aliceId, wrappedKey: "encrypted" }, { userId: bobId, wrappedKey: "encrypted" }],
      })).rejects.toThrow();
      expect(await count("conversations")).toBe(before);
    } finally { await connection.query("DROP TRIGGER locat_test_fail_membership"); }
  });
  it("rotates group keys, retains historical access, and revokes removed members", async () => {
    const [third]=await db.select().from(schema.users).where(eq(schema.users.username,"outsider"));
    const thirdId=third.id;
    const all=[aliceId,bobId,thirdId];
    const wrap=async(key:CryptoKey, ids:number[], wrapper=0)=>Promise.all(ids.map(async id=>({userId:id,publicKey:identities[all.indexOf(id)].publicKeyB64,wrappedKey:await wrapGroupKey(key,identities[wrapper].privateKey,identities[all.indexOf(id)].publicKeyB64)})));
    const firstKey=await generateGroupKey();
    const created=await alice.conversations.createGroup({name:"Rotation test",memberIds:[bobId],wrappedKeys:await wrap(firstKey,[aliceId,bobId])});
    const id=created.conversationId;
    const envelopeFor=async(key:CryptoKey,epoch:number)=>JSON.stringify({...JSON.parse(await encryptPayload(key,{type:"text",text:`epoch ${epoch}`})),groupEpoch:epoch});
    const first=await alice.messages.send({conversationId:id,envelope:await envelopeFor(firstKey,1),clientMessageId:crypto.randomUUID()});
    const secondKey=await generateGroupKey();
    await expect(bob.conversations.updateGroup({conversationId:id,expectedEpoch:1,name:"No",memberIds:[aliceId,bobId],wrappedKeys:await wrap(secondKey,[aliceId,bobId])})).rejects.toThrow("owner");
    await alice.conversations.updateGroup({conversationId:id,expectedEpoch:1,name:"With third",memberIds:all,wrappedKeys:await wrap(secondKey,all)});
    const historical=await bob.conversations.groupKey({conversationId:id,epoch:1});
    const oldKey=await unwrapGroupKey(historical.wrappedKey,identities[1].privateKey,historical.wrapperPublicKey);
    const backlog=(await bob.messages.sync({after:first.messageId-1})).items.find(m=>m.messageId===first.messageId)!;
    expect(await decryptPayload(oldKey,backlog.envelope)).toEqual({type:"text",text:"epoch 1"});
    await expect(outsider.conversations.groupKey({conversationId:id,epoch:1})).rejects.toThrow("no key");
    const thirdKey=await generateGroupKey();
    await alice.conversations.updateGroup({conversationId:id,expectedEpoch:2,name:"Bob removed",memberIds:[aliceId,thirdId],wrappedKeys:await wrap(thirdKey,[aliceId,thirdId])});
    await expect(bob.conversations.groupKey({conversationId:id,epoch:1})).rejects.toThrow();
    expect((await bob.messages.sync({after:first.messageId-1})).items.filter(m=>m.conversationId===id)).toHaveLength(0);
    await expect(bob.messages.send({conversationId:id,envelope:await envelopeFor(thirdKey,3),clientMessageId:crypto.randomUUID()})).rejects.toThrow("Not a member");
    await expect(alice.messages.send({conversationId:id,envelope:await envelopeFor(secondKey,2),clientMessageId:crypto.randomUUID()})).rejects.toThrow("encryption changed");
    const future=await alice.messages.send({conversationId:id,envelope:await envelopeFor(thirdKey,3),clientMessageId:crypto.randomUUID()});
    const wrapped=await outsider.conversations.groupKey({conversationId:id,epoch:3});
    const receiving=await unwrapGroupKey(wrapped.wrappedKey,identities[2].privateKey,wrapped.wrapperPublicKey);
    expect(await decryptPayload(receiving,(await outsider.messages.sync({after:future.messageId-1})).items.find(m=>m.messageId===future.messageId)!.envelope)).toEqual({type:"text",text:"epoch 3"});
    await expect(alice.conversations.leaveGroup({conversationId:id})).rejects.toThrow("Transfer ownership");
    await alice.conversations.transferGroup({conversationId:id,ownerId:thirdId});
    await alice.conversations.leaveGroup({conversationId:id});
    await expect(outsider.messages.send({conversationId:id,envelope:await envelopeFor(thirdKey,3),clientMessageId:crypto.randomUUID()})).rejects.toThrow("encryption changed");
    const fourthKey=await generateGroupKey();
    await outsider.conversations.updateGroup({conversationId:id,expectedEpoch:3,name:"Remaining owner",memberIds:[thirdId],wrappedKeys:await wrap(fourthKey,[thirdId],2)});
    expect((await outsider.conversations.list()).find(c=>c.id===id)?.rotationRequired).toBe(false);
    await outsider.messages.send({conversationId:id,envelope:await envelopeFor(fourthKey,4),clientMessageId:crypto.randomUUID()});
    await expect(alice.conversations.groupKey({conversationId:id,epoch:4})).rejects.toThrow();
    const closingKey=await generateGroupKey();
    const closing=await alice.conversations.createGroup({name:"Close test",memberIds:[bobId],wrappedKeys:await wrap(closingKey,[aliceId,bobId])});
    await alice.conversations.updateGroup({conversationId:closing.conversationId,expectedEpoch:1,name:"Only owner",memberIds:[aliceId],wrappedKeys:await wrap(await generateGroupKey(),[aliceId])});
    await alice.conversations.leaveGroup({conversationId:closing.conversationId});
    expect((await alice.conversations.list()).some(c=>c.id===closing.conversationId)).toBe(false);
  }, 20000);

  it("binds push subscriptions to the owning active session", async () => {
    const webpush = (await import("web-push")).default;
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey; process.env.VAPID_SUBJECT = "mailto:test@example.com";
    const user = await db.query.users.findFirst({ where:eq(schema.users.id,aliceId) });
    const login = await alice.auth.login({ username:"alice", password:"test-password-long" });
    const signedIn = router.createCaller({ req:new Request("http://localhost"),resHeaders:new Headers(),user,sessionToken:login.token });
    const input = { endpoint:"https://fcm.googleapis.com/fcm/send/locat-test",keys:{ p256dh:keys.publicKey, auth:Buffer.alloc(16,1).toString("base64url") } };
    await signedIn.push.subscribe(input); await signedIn.push.subscribe(input);
    expect(await count("push_subscriptions")).toBe(1);
    await expect(bob.push.subscribe(input)).rejects.toThrow();
    await expect(signedIn.push.subscribe({ ...input, endpoint:"https://127.0.0.1/private" })).rejects.toThrow();
    await signedIn.push.unsubscribe(input); expect(await count("push_subscriptions")).toBe(0);
    await signedIn.push.subscribe(input); await alice.auth.login({ username:"alice",password:"test-password-long" });
    expect(await count("push_subscriptions")).toBe(0);
    delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; delete process.env.VAPID_SUBJECT;
  });

  it("protects admin routes, audits account controls, and encrypts recoverable metadata", async () => {
    await expect(bob.admin.stats()).rejects.toThrow("Administrator");
    await db.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, aliceId));
    const rows = await alice.admin.users({ search: "bob", page: 0 });
    expect(rows.items).toHaveLength(1);
    expect(rows.items[0]).not.toHaveProperty("passwordHash");
    expect(rows.items[0]).not.toHaveProperty("encryptedPrivateKey");
    await expect(alice.admin.accountAction({ userId: bobId, action: "disable", password: "incorrect" })).rejects.toThrow("Incorrect");
    await alice.admin.accountAction({ userId: bobId, action: "disable", password: "test-password-long" });
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, bobId) }))!.disabled).toBe(true);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, bobId))).toHaveLength(0);
    await alice.admin.accountAction({ userId: bobId, action: "enable", password: "test-password-long" });
    await expect(alice.admin.accountAction({ userId: aliceId, action: "disable", password: "test-password-long" })).rejects.toThrow("own administrator");
    expect((await alice.admin.stats()).accounts).toBe(3);
    expect((await alice.admin.audit({ page: 0 })).items.map(row => row.action)).toContain("disable");
    const backup = await alice.admin.backup({ password: "test-password-long", backupPassword: "long-backup-password" });
    expect(backup).not.toContain("passwordHash");
    const { createDecipheriv, scryptSync } = await import("node:crypto");
    const encrypted = JSON.parse(backup);
    const key = scryptSync("long-backup-password", Buffer.from(encrypted.salt,"base64"),32);
    const decipher = createDecipheriv("aes-256-gcm",key,Buffer.from(encrypted.iv,"base64"));
    decipher.setAAD(Buffer.from("Locat server metadata v1")); decipher.setAuthTag(Buffer.from(encrypted.tag,"base64"));
    const metadata = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data,"base64")),decipher.final()]).toString());
    expect(metadata.accounts).toHaveLength(3); expect(metadata).not.toHaveProperty("sessions"); expect(metadata).not.toHaveProperty("messages");
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(),"locat-restore-"));
    const path = join(dir,"backup.locat-server"); await writeFile(path,backup);
    const restore = () => spawnSync(process.execPath,["scripts/restore-server.mjs",path], { env:{...process.env, DATABASE_URL:databaseUrl!,LOCAT_BACKUP_PASSWORD:"long-backup-password"},encoding:"utf8" });
    try {
      expect(restore().stderr).toContain("target database is not empty");
      await connection.query("SET FOREIGN_KEY_CHECKS=0");
      for(const table of ["group_keys","push_subscriptions","admin_audit","message_deliveries","messages","send_receipts","sessions","conversation_members","conversations","users"]) await connection.query(`DELETE FROM ${table}`);
      await connection.query("SET FOREIGN_KEY_CHECKS=1");
      const result = restore(); expect(result.status, result.stderr).toBe(0);
      expect(await count("users")).toBe(3);
      expect(await count("conversations")).toBe(metadata.conversations.length);
      expect(await count("group_keys")).toBe(metadata.groupKeys.length);
      expect(await count("sessions")).toBe(0);
      const restored = await db.query.users.findFirst({ where:eq(schema.users.id,aliceId) });
      expect(restored!.isAdmin).toBe(true);
      expect((await alice.auth.login({ username:"alice", password:"test-password-long" })).user.id).toBe(aliceId);
    } finally { await rm(dir,{ recursive:true,force:true }); }
  }, 20000);

});
