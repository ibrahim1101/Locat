import { z } from "zod";

export const privateModuleSchema = z.enum(["vault", "secrets"]);
export type PrivateModule = z.infer<typeof privateModuleSchema>;
export const PRIVATE_STORE_QUOTA = 64 * 1024 * 1024;
export const PRIVATE_STORE_MAX_OBJECTS = 128;
export const PRIVATE_FILE_LIMIT = 2 * 1024 * 1024;
export const PRIVATE_CIPHER_LIMIT = 4 * 1024 * 1024;
export const PRIVATE_KDF_ITERATIONS = 600_000;
const base64 = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const privateEnvelopeSchema = z.object({
  v: z.literal(1), iv: base64.length(16),
  data: base64.min(24).max(PRIVATE_CIPHER_LIMIT),
}).strict();
export type PrivateEnvelope = z.infer<typeof privateEnvelopeSchema>;
export const privateConfigSchema = z.object({
  v: z.literal(1), storeId: z.uuid(), salt: base64.length(24).regex(/==$/),
  iterations: z.literal(PRIVATE_KDF_ITERATIONS), wrappedKey: privateEnvelopeSchema.extend({ data: base64.length(64) }),
}).strict();
export type PrivateConfig = z.infer<typeof privateConfigSchema>;
export const privateEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), name: z.string().min(1).max(255), folder: z.string().max(200),
    mime: z.string().max(128), bytes: z.number().int().min(0).max(PRIVATE_FILE_LIMIT),
    data: base64.max(4 * Math.ceil(PRIVATE_FILE_LIMIT / 3)), createdAt: z.number().int().positive(),
  }).strict(),
  z.object({ kind: z.literal("credential"), name: z.string().min(1).max(200), folder: z.string().max(200),
    username: z.string().max(500), password: z.string().max(4096), url: z.string().max(2048),
    note: z.string().max(16000), createdAt: z.number().int().positive(),
  }).strict(),
]);
export type PrivateEntry = z.infer<typeof privateEntrySchema>;
