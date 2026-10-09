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
  lcCode: varchar("lc_code", { length: 16 }).unique("users_lc_code_unique"),
  bio: varchar("bio", { length: 280 }),
  avatar: text("avatar"),
  allowAvatarDownload: boolean("allow_avatar_download").notNull().default(false),
  usernameVisibility: mysqlEnum("username_visibility", ["everyone", "contacts", "nobody"]).notNull().default("everyone"),
  profileVisibility: mysqlEnum("profile_visibility", ["everyone", "contacts", "nobody"]).notNull().default("everyone"),
  presenceVisibility: mysqlEnum("presence_visibility", ["everyone", "contacts", "nobody"]).notNull().default("contacts"),
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

export const userBlocks = mysqlTable("user_blocks", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  blockerId: bigint("blocker_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  blockedId: bigint("blocked_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_blocks_pair_unique").on(t.blockerId, t.blockedId),
  index("user_blocks_blocked_idx").on(t.blockedId),
]);

// One row per unordered pair. Pending rows remember who initiated the request;
// accepted rows are symmetric contacts. Decline/cancel/remove deletes the row.
export const contactRelationships = mysqlTable("contact_relationships", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userLowId: bigint("user_low_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userHighId: bigint("user_high_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requestedById: bigint("requested_by_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["pending", "accepted"]).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("contact_relationships_pair_unique").on(t.userLowId, t.userHighId),
  index("contact_relationships_high_idx").on(t.userHighId),
  index("contact_relationships_requester_idx").on(t.requestedById),
]);

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


/**
 * Unreleased passwordless authentication schema. No authentication route uses
 * these tables until proof-of-possession and approval protocols are reviewed.
 */
export const recoveryCredentials = mysqlTable("recovery_credentials", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  verifier: varchar("verifier", { length: 64 }).notNull().unique(),
  encryptedIdentity: text("encrypted_identity").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, t => [index("recovery_credentials_user_idx").on(t.userId)]);

export const deviceLinkRequests = mysqlTable("device_link_requests", {
  id: varchar("id", { length: 128 }).primaryKey(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  requesterPublicKey: text("requester_public_key").notNull(),
  approverPublicKey: text("approver_public_key"),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true })
    .references(() => users.id, { onDelete: "cascade" }),
  encryptedIdentity: text("encrypted_identity"),
  state: mysqlEnum("state", ["pending", "approved", "consumed", "rejected"]).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, t => [index("device_link_requests_expires_idx").on(t.expiresAt)]);

// ─── Locat Sentinel (M1): incident management ────────────────────────────────
// Scoped, revocable integration tokens authenticate inbound webhooks from
// external security tools (nScout, PipelineGuard, custom). Only the sha256 hash
// of a token is ever stored — the plaintext is shown once at creation time and
// never logged. Integration-token auth is entirely separate from user sessions.
export const integrationTokens = mysqlTable("integration_tokens", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  source: varchar("source", { length: 64 }).notNull().default("custom"),
  scope: varchar("scope", { length: 255 }).notNull().default("incidents:write"),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  tokenPrefix: varchar("token_prefix", { length: 16 }).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (t) => [index("integration_tokens_user_idx").on(t.userId)]);

export const incidents = mysqlTable("incidents", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenId: bigint("token_id", { mode: "number", unsigned: true })
    .references(() => integrationTokens.id, { onDelete: "set null" }),
  source: varchar("source", { length: 64 }).notNull().default("custom"),
  severity: mysqlEnum("severity", ["info", "low", "medium", "high", "critical"]).notNull().default("medium"),
  status: mysqlEnum("status", ["open", "acknowledged", "resolved"]).notNull().default("open"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  fingerprint: varchar("fingerprint", { length: 128 }),
  externalId: varchar("external_id", { length: 128 }),
  acknowledgedBy: bigint("acknowledged_by", { mode: "number", unsigned: true }),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("incidents_user_idx").on(t.userId),
  index("incidents_user_status_idx").on(t.userId, t.status),
  index("incidents_fingerprint_idx").on(t.userId, t.fingerprint),
]);

export const incidentEvents = mysqlTable("incident_events", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  incidentId: bigint("incident_id", { mode: "number", unsigned: true }).notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  action: mysqlEnum("action", ["created", "updated", "acknowledged", "resolved", "reopened", "note"]).notNull(),
  actorId: bigint("actor_id", { mode: "number", unsigned: true }),
  detail: varchar("detail", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("incident_events_incident_idx").on(t.incidentId)]);

export type IntegrationToken = typeof integrationTokens.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type IncidentEvent = typeof incidentEvents.$inferSelect;

// ─── Locat Link (M2): device pairing + encrypted server-relayed transfer ─────
// Each device holds its own ECDH P-256 keypair (separate from the messaging
// identity key). The server stores only device public keys and opaque
// ciphertext; transfer/clipboard payloads are encrypted client-side with a key
// derived from ECDH between the two paired devices. All rows are scoped to the
// owning account. This is SERVER-RELAYED, not direct peer-to-peer (see LINK.md).
export const linkDevices = mysqlTable("link_devices", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  platform: varchar("platform", { length: 32 }).notNull().default("web"),
  publicKey: text("public_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (t) => [
  index("link_devices_user_idx").on(t.userId),
]);

export const linkPairings = mysqlTable("link_pairings", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceA: bigint("device_a", { mode: "number", unsigned: true }).notNull()
    .references(() => linkDevices.id, { onDelete: "cascade" }),
  deviceB: bigint("device_b", { mode: "number", unsigned: true }).notNull()
    .references(() => linkDevices.id, { onDelete: "cascade" }),
  confirmedA: boolean("confirmed_a").notNull().default(false),
  confirmedB: boolean("confirmed_b").notNull().default(false),
  status: mysqlEnum("status", ["pending", "verified", "rejected"]).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("link_pairings_user_idx").on(t.userId),
  uniqueIndex("link_pairings_pair_unique").on(t.deviceA, t.deviceB),
]);

export const linkTransfers = mysqlTable("link_transfers", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fromDevice: bigint("from_device", { mode: "number", unsigned: true }).notNull()
    .references(() => linkDevices.id, { onDelete: "cascade" }),
  toDevice: bigint("to_device", { mode: "number", unsigned: true }).notNull()
    .references(() => linkDevices.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  mime: varchar("mime", { length: 128 }).notNull().default("application/octet-stream"),
  size: bigint("size", { mode: "number", unsigned: true }).notNull(),
  chunkCount: int("chunk_count").notNull(),
  status: mysqlEnum("status", ["pending", "active", "complete", "cancelled", "failed"]).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("link_transfers_user_idx").on(t.userId),
  index("link_transfers_to_idx").on(t.toDevice, t.status),
]);

export const linkTransferChunks = mysqlTable("link_transfer_chunks", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  transferId: bigint("transfer_id", { mode: "number", unsigned: true }).notNull()
    .references(() => linkTransfers.id, { onDelete: "cascade" }),
  seq: int("seq").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(),
  data: mediumtext("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("link_chunk_unique").on(t.transferId, t.seq)]);

export const linkMessages = mysqlTable("link_messages", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fromDevice: bigint("from_device", { mode: "number", unsigned: true }).notNull()
    .references(() => linkDevices.id, { onDelete: "cascade" }),
  toDevice: bigint("to_device", { mode: "number", unsigned: true }).notNull()
    .references(() => linkDevices.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["clipboard", "text", "url"]).notNull().default("clipboard"),
  iv: varchar("iv", { length: 32 }).notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
}, (t) => [index("link_messages_to_idx").on(t.toDevice, t.deliveredAt)]);

export type LinkDevice = typeof linkDevices.$inferSelect;
export type LinkPairing = typeof linkPairings.$inferSelect;
export type LinkTransfer = typeof linkTransfers.$inferSelect;
