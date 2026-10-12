/**
 * Client-side AES-GCM chunk protection for a future authenticated device channel.
 * Keys must be established by a separately authenticated peer-to-peer handshake.
 * Never send the raw key alongside ciphertext or store it on the server.
 */
export type EncryptedMediaChunk = {
  sequence: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};
const MAX_CHUNK_BYTES = 1024 * 1024;

export async function importMediaTransferKey(raw: ArrayBuffer): Promise<CryptoKey> {
  if (raw.byteLength !== 32) throw new Error("Media transfer requires a 256-bit key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptMediaChunk(key: CryptoKey, transferId: string, sequence: number, plaintext: ArrayBuffer): Promise<EncryptedMediaChunk> {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("Invalid chunk sequence");
  if (plaintext.byteLength === 0 || plaintext.byteLength > MAX_CHUNK_BYTES) throw new Error("Invalid chunk length");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(JSON.stringify([transferId, sequence]));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad, tagLength: 128 }, key, plaintext);
  return { sequence, iv, ciphertext };
}
export async function decryptMediaChunk(key: CryptoKey, transferId: string, chunk: EncryptedMediaChunk): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(chunk.sequence) || chunk.sequence < 0 || chunk.iv.byteLength !== 12) throw new Error("Invalid encrypted chunk");
  if (chunk.ciphertext.byteLength < 17 || chunk.ciphertext.byteLength > MAX_CHUNK_BYTES + 16) throw new Error("Invalid encrypted chunk size");
  const aad = new TextEncoder().encode(JSON.stringify([transferId, chunk.sequence]));
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: chunk.iv as BufferSource, additionalData: aad, tagLength: 128 }, key, chunk.ciphertext);
}
