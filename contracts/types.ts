// Shared types between frontend and backend.
// The server only ever sees *envelopes* — encrypted, opaque payloads.

/** Encrypted envelope stored (transiently) in the relay queue. */
export type EncryptedEnvelope = {
  v: 1;
  /** base64 AES-GCM iv */
  iv: string;
  /** base64 ciphertext of the JSON plaintext payload */
  data: string;
};

/** Decrypted payload — only ever exists on devices. */
export type MessagePayload =
  | { type: "text"; text: string; messageRef?: string }
  | { type: "image"; mime: string; name: string; dataB64: string; messageRef?: string };

/** Event pushed from server to online clients over the subscription stream. */
export type RelayEvent =
  | {
      type: "message";
      deliveryId: number;
      messageId: number;
      conversationId: number;
      senderId: number;
      senderName: string;
      envelope: string; // JSON-serialized EncryptedEnvelope
      createdAt: Date;
    }
  | { type: "presence"; online: number[] }
  | { type: "conversations-changed" };

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  bio: string | null;
  publicKey: string;
};

export type ConversationSummary = {
  id: number;
  type: "direct" | "group";
  name: string | null;
  createdAt: Date;
  members: PublicUser[];
  createdBy?: number;
  groupEpoch?: number;
  rotationRequired?: boolean;
  wrapperPublicKey?: string | null;
  archived?: boolean;
  /** my wrapped group key (group chats only) */
  wrappedKey: string | null;
  wrappedBy: number | null;
};
