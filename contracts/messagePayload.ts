import { z } from "zod";

// One bounded format for authenticated live messages and encrypted archives.
// Extend this contract before adding new media or encrypted control events.
const base64 = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const referenceSchema = z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]);
export const messageReplySchema = z.object({ target: referenceSchema,
  senderId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
export type MessageReply = z.infer<typeof messageReplySchema>;
const referenceFields = { messageRef: z.string().uuid().optional(), replyTo: messageReplySchema.optional(), forwarded: z.literal(true).optional() };
export const messagePayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("location"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0).max(1_000_000),
    capturedAt: z.number().int().nonnegative().max(8_640_000_000_000_000),
    ...referenceFields,
  }).strict(),
  z.object({ type: z.literal("text"), text: z.string().max(1_000_000), ...referenceFields }).strict(),
  z.object({
    type: z.literal("image"),
    mime: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]),
    name: z.string().max(1024),
    dataB64: base64.max(6_000_000),
    ...referenceFields,
  }).strict(),
  z.object({
    type: z.literal("file"),
    mime: z.string().min(1).max(255),
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(2_900_000),
    dataB64: base64.max(4_000_000),
    ...referenceFields,
  }).strict(),
  z.object({
    type: z.literal("voice"),
    mime: z.enum(["audio/webm", "audio/ogg", "audio/mp4"]),
    dataB64: base64.max(4_000_000),
    durationMs: z.number().int().min(250).max(60_000),
    ...referenceFields,
  }).strict(),
]);

export type MessagePayload = z.infer<typeof messagePayloadSchema>;

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export const reactionEmojiSchema = z.enum(REACTION_EMOJIS);
export type ReactionEmoji = z.infer<typeof reactionEmojiSchema>;

export const pinStateSchema = z.object({ pinned: z.boolean(), mid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  actorId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
export type PinState = z.infer<typeof pinStateSchema>;
export const messageControlSchema = z.discriminatedUnion("action", [
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("pin"),
    target: referenceSchema, targetSenderId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), pinned: z.boolean() }).strict(),
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("reaction"),
    target: z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]),
    targetSenderId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    emoji: reactionEmojiSchema.nullable() }).strict(),
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("edit"),
    target: z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]), text: z.string().max(1_000_000) }).strict(),
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("delete"),
    target: z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]) }).strict(),
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("read"),
    target: z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]) }).strict(),
]);
export type MessageControl = z.infer<typeof messageControlSchema>;
export const relayPayloadSchema = z.union([messagePayloadSchema, messageControlSchema]);
