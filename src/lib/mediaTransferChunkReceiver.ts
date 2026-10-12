import { decryptMediaChunk, type EncryptedMediaChunk } from "./mediaTransferCrypto";
import { verifyMediaPayload } from "./mediaTransferIntegrity";

/**
 * Ordered, bounded, authenticated receiver for a single transfer.
 * The transport must bind transferId and session key to a verified peer.
 * Chunks are held in memory; production transport should stream to disk.
 */
export class MediaTransferChunkReceiver {
  private nextSequence = 0;
  private receivedBytes = 0;
  private readonly chunks: Uint8Array[] = [];
  private complete = false;
  private readonly key: CryptoKey;
  private readonly transferId: string;
  private readonly maxBytes: number;

  constructor(
    key: CryptoKey,
    transferId: string,
    maxBytes: number,
  ) {
    this.key = key;
    this.transferId = transferId;
    this.maxBytes = maxBytes;
    if (!transferId || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new Error("Invalid transfer limits");
    }
  }

  async accept(chunk: EncryptedMediaChunk): Promise<number> {
    if (this.complete) throw new Error("Transfer already finalized");
    if (chunk.sequence !== this.nextSequence) throw new Error("Out-of-order or replayed media chunk");
    // Do not mutate receiver state until authentication succeeds.
    const plaintext = new Uint8Array(await decryptMediaChunk(this.key, this.transferId, chunk));
    if (this.receivedBytes + plaintext.byteLength > this.maxBytes) {
      throw new Error("Transfer exceeds declared maximum size");
    }
    this.chunks.push(plaintext);
    this.receivedBytes += plaintext.byteLength;
    this.nextSequence += 1;
    return this.receivedBytes;
  }

  async finishVerified(expectedChunks: number, expectedBytes: number, expectedSha256: string): Promise<Uint8Array> {
    if (this.complete) throw new Error("Transfer already finalized");
    if (!Number.isSafeInteger(expectedChunks) || expectedChunks < 1 || expectedChunks !== this.nextSequence ||
        !Number.isSafeInteger(expectedBytes) || expectedBytes !== this.receivedBytes) {
      throw new Error("Incomplete or mismatched media transfer");
    }
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("Invalid expected file digest");
    const payload = new Uint8Array(this.receivedBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      payload.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (!(await verifyMediaPayload(payload, expectedSha256))) {
      throw new Error("Completed media transfer digest mismatch");
    }
    this.complete = true;
    this.chunks.length = 0;
    return payload;
  }

  finish(expectedChunks: number, expectedBytes: number): Uint8Array {
    if (this.complete) throw new Error("Transfer already finalized");
    if (!Number.isSafeInteger(expectedChunks) || expectedChunks < 1 || expectedChunks !== this.nextSequence ||
        !Number.isSafeInteger(expectedBytes) || expectedBytes !== this.receivedBytes) {
      throw new Error("Incomplete or mismatched media transfer");
    }
    const result = new Uint8Array(this.receivedBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.complete = true;
    this.chunks.length = 0;
    return result;
  }
}
