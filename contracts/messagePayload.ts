import { z } from "zod";

// One bounded format for authenticated live messages and encrypted archives.
// Extend this contract before adding new media or encrypted control events.
const base64 = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const messagePayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(1_000_000), messageRef: z.string().uuid().optional() }).strict(),
  z.object({
    type: z.literal("image"),
    mime: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]),
    name: z.string().max(1024),
    dataB64: base64.max(6_000_000),
    messageRef: z.string().uuid().optional(),
  }).strict(),
]);

export type MessagePayload = z.infer<typeof messagePayloadSchema>;

export const messageControlSchema = z.discriminatedUnion("action", [
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("edit"),
    target: z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]), text: z.string().max(1_000_000) }).strict(),
  z.object({ type: z.literal("control"), version: z.literal(1), action: z.literal("delete"),
    target: z.union([z.string().uuid(), z.string().regex(/^legacy:[1-9][0-9]{0,15}$/)]) }).strict(),
]);
export type MessageControl = z.infer<typeof messageControlSchema>;
export const relayPayloadSchema = z.union([messagePayloadSchema, messageControlSchema]);
