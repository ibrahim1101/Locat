import {
  mysqlTable,
  boolean,
  int,
  mysqlEnum,
  bigint,
  varchar,
  text,
  mediumtext,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

// ─── Users ──────────────────────────────────────────────────────────────────
// The server stores credentials, public keys, and the *encrypted* private-key
// backup (wrapped with a key derived from the user's password client-side).
// The server can never read the private key.
export const users = mysqlTable("users", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  bio: varchar("bio", { length: 280 }),
  isAdmin: boolean("is_admin").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  // base64 SPKI of the user's ECDH P-256 public key (public key directory)
  publicKey: text("public_key").notNull(),
  // base64 blob: PKCS8 private key, AES-GCM encrypted with PBKDF2(password)
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  keySalt: varchar("key_salt", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessions = mysqlTable(
  "sessions",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Conversations ───────────────────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  type: mysqlEnum("type", ["direct", "group"]).notNull(),
  groupEpoch: int("group_epoch").notNull().default(1),
  rotationRequired: boolean("rotation_required").notNull().default(false),
  name: varchar("name", { length: 128 }),
  createdBy: bigint("created_by", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationMembers = mysqlTable(
  "conversation_members",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    conversationId: bigint("conversation_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // group chats only: the group AES key, wrapped with a key derived from
    // ECDH(wrapperPriv, memberPub). Server sees only ciphertext.
    wrappedKey: text("wrapped_key"),
    wrappedBy: bigint("wrapped_by", { mode: "number", unsigned: true }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conv_member_unique").on(t.conversationId, t.userId),
    index("member_user_idx").on(t.userId),
  ],
);

// ─── Transient message queue ─────────────────────────────────────────────────
// Envelopes are end-to-end encrypted client-side and opaque to the server.
// Rows live only until every recipient has acknowledged delivery — then they
// are deleted. Chat history lives on the devices, not here.
export const messages = mysqlTable(
  "messages",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    conversationId: bigint("conversation_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: bigint("sender_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    envelope: mediumtext("envelope").notNull(),
    clientMessageId: varchar("client_message_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("messages_conv_idx").on(t.conversationId),
    uniqueIndex("messages_sender_client_unique").on(t.senderId, t.clientMessageId),
  ],
);

export const messageDeliveries = mysqlTable(
  "message_deliveries",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    messageId: bigint("message_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    recipientId: bigint("recipient_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("delivery_unique").on(t.messageId, t.recipientId),
    index("delivery_recipient_idx").on(t.recipientId),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageDelivery = typeof messageDeliveries.$inferSelect;

// Retry receipts contain metadata only; retained for seven days after sending.
export const sendReceipts = mysqlTable("send_receipts", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  senderId: bigint("sender_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientMessageId: varchar("client_message_id", { length: 36 }).notNull(),
  messageId: bigint("message_id", { mode: "number", unsigned: true }).notNull(),
  conversationId: bigint("conversation_id", { mode: "number", unsigned: true }).notNull(),
  envelopeHash: varchar("envelope_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull(),
}, (t) => [uniqueIndex("receipt_sender_client_unique").on(t.senderId, t.clientMessageId),
  index("receipt_created_idx").on(t.createdAt)]);

export const adminAudit = mysqlTable("admin_audit", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  actorId: bigint("actor_id", { mode: "number", unsigned: true }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetId: bigint("target_id", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionToken: varchar("session_token", { length: 128 }).notNull(),
  endpointHash: varchar("endpoint_hash", { length: 64 }).notNull().unique(),
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 128 }).notNull(),
  auth: varchar("auth", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupKeys = mysqlTable("group_keys", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  conversationId: bigint("conversation_id", { mode: "number", unsigned: true }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  epoch: int("epoch").notNull(),
  wrappedKey: text("wrapped_key").notNull(),
  wrapperPublicKey: text("wrapper_public_key").notNull(),
}, t => [uniqueIndex("group_key_user_epoch_unique").on(t.conversationId,t.userId,t.epoch)]);
