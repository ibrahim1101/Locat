import { encryptMediaChunk, type EncryptedMediaChunk } from "./mediaTransferCrypto";

export const MEDIA_TRANSFER_CHUNK_SIZE = 256 * 1024;
export const MAX_MEDIA_TRANSFER_BYTES = 512 * 1024 * 1024;

/**
 * Encrypts a locally selected File as ordered authenticated chunks.
 * The caller MUST bind key/transferId to an authenticated paired device.
 * No file bytes leave the device until the caller sends yielded chunks.
 */
export async function* encryptMediaFile(
  file: Blob,
  key: CryptoKey,
  transferId: string,
  chunkSize = MEDIA_TRANSFER_CHUNK_SIZE,
): AsyncGenerator<EncryptedMediaChunk> {
  if (!transferId || !Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 1024 * 1024) {
    throw new Error("Invalid media transfer parameters");
  }
  if (file.size === 0 || file.size > MAX_MEDIA_TRANSFER_BYTES) {
    throw new Error("Unsupported media file size");
  }
  let sequence = 0;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const plaintext = await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer();
    yield await encryptMediaChunk(key, transferId, sequence++, plaintext);
  }
}

export function mediaTransferChunkCount(fileSize: number, chunkSize = MEDIA_TRANSFER_CHUNK_SIZE): number {
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_MEDIA_TRANSFER_BYTES ||
      !Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 1024 * 1024) {
    throw new Error("Invalid media transfer size");
  }
  return Math.ceil(fileSize / chunkSize);
}
