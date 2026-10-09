/** Read no more than limit UTF-8 bytes, even if Content-Length is absent or false. */
export class WebhookBodyTooLargeError extends Error {
  constructor() { super("Webhook body exceeds configured byte limit"); }
}

export async function readBoundedWebhookBody(request: Request, limit: number): Promise<string> {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("Invalid body limit");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new WebhookBodyTooLargeError();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(combined);
}
